import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

const PLATFORM_FEE_PERCENT = 5; // BridgeofTalent flat 5%

export { stripe };

/**
 * Create a Stripe Connect account for a freelancer
 */
export async function createConnectAccount(userId: string, email: string, country: string = 'US') {
  const account = await stripe.accounts.create({
    type: 'express',
    country,
    email,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_type: 'individual',
    metadata: { userId },
  });

  const supabase = createAdminClient();
  await supabase
    .from('profiles')
    .update({ stripe_connect_id: account.id })
    .eq('id', userId);

  return account;
}

/**
 * Create onboarding link for Connect account
 */
export async function createAccountLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?success=true`,
    type: 'account_onboarding',
  });
}

/**
 * Create a payment intent for escrow funding
 */
export async function createEscrowPaymentIntent({
  amount,
  currency = 'usd',
  clientId,
  projectId,
  milestoneId,
}: {
  amount: number;
  currency?: string;
  clientId: string;
  projectId: string;
  milestoneId: string;
}) {
  const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100); // in cents
  const freelancerAmount = Math.round(amount * 100) - platformFee;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      type: 'escrow_funding',
      clientId,
      projectId,
      milestoneId,
      platformFee: String(platformFee),
      freelancerAmount: String(freelancerAmount),
    },
    transfer_group: `escrow_${projectId}`,
  });

  return paymentIntent;
}

/**
 * Release escrow funds to freelancer
 */
export async function releaseEscrowFunds({
  escrowId,
  freelancerStripeAccountId,
  amount,
}: {
  escrowId: string;
  freelancerStripeAccountId: string;
  amount: number;
}) {
  const supabase = createAdminClient();

  // Get escrow details
  const { data: escrow } = await supabase
    .from('escrow_accounts')
    .select('*')
    .eq('id', escrowId)
    .single();

  if (!escrow || escrow.status !== 'held') {
    throw new Error('Escrow not available for release');
  }

  const transferAmount = Math.round(amount * 100);
  const platformFee = Math.round(transferAmount * (PLATFORM_FEE_PERCENT / 100));
  const freelancerPayout = transferAmount - platformFee;

  // Create transfer to freelancer
  const transfer = await stripe.transfers.create({
    amount: freelancerPayout,
    currency: 'usd',
    destination: freelancerStripeAccountId,
    transfer_group: escrow.stripe_payment_intent_id,
    metadata: { escrowId, type: 'freelancer_payout' },
  });

  // Update escrow status
  await supabase
    .from('escrow_accounts')
    .update({
      status: 'released',
      released_at: new Date().toISOString(),
      freelancer_payout: freelancerPayout / 100,
      platform_fee: platformFee / 100,
    })
    .eq('id', escrowId);

  // Record transaction
  await supabase.from('transactions').insert({
    escrow_id: escrowId,
    user_id: escrow.client_id,
    type: 'release',
    amount: amount,
    stripe_transaction_id: transfer.id,
    description: `Escrow released for project ${escrow.project_id}`,
  });

  return transfer;
}

/**
 * Process refund for escrow
 */
export async function refundEscrow(escrowId: string, reason?: string) {
  const supabase = createAdminClient();

  const { data: escrow } = await supabase
    .from('escrow_accounts')
    .select('*')
    .eq('id', escrowId)
    .single();

  if (!escrow || escrow.status !== 'held') {
    throw new Error('Escrow not available for refund');
  }

  const refund = await stripe.refunds.create({
    payment_intent: escrow.stripe_payment_intent_id,
    reason: 'requested_by_customer',
    metadata: { escrowId, reason: reason || 'Dispute resolution' },
  });

  await supabase
    .from('escrow_accounts')
    .update({ status: 'refunded' })
    .eq('id', escrowId);

  await supabase.from('transactions').insert({
    escrow_id: escrowId,
    user_id: escrow.client_id,
    type: 'refund',
    amount: escrow.total_amount,
    stripe_transaction_id: refund.id,
    description: `Escrow refunded: ${reason || 'Dispute resolution'}`,
  });

  return refund;
}

/**
 * Create subscription for premium tier
 */
export async function createSubscription(
  userId: string,
  priceId: string,
  paymentMethodId: string
) {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const customer = await stripe.customers.create({
      email: user.user?.email,
      metadata: { userId },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
  }

  // Attach payment method
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId },
  });

  return subscription;
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: Stripe.Event) {
  const supabase = createAdminClient();

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      if (paymentIntent.metadata?.type === 'escrow_funding') {
        await supabase
          .from('escrow_accounts')
          .update({ status: 'held' })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        await supabase.from('transactions').insert({
          user_id: paymentIntent.metadata.clientId,
          type: 'deposit',
          amount: paymentIntent.amount / 100,
          stripe_transaction_id: paymentIntent.id,
          description: 'Escrow funded',
          metadata: {
            projectId: paymentIntent.metadata.projectId,
            milestoneId: paymentIntent.metadata.milestoneId,
          },
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id, tier')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (sub) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: sub.tier })
          .eq('id', sub.user_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', userId);
      }
      break;
    }
  }
}
