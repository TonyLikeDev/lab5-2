import {
  CustomerField,
  FormattedCustomersTable,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { supabaseAdmin } from './supabase';
import { auth } from '@/auth';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated.');
  }
  return session.user.id;
}

export async function fetchRevenue() {
  const { data, error } = await supabaseAdmin
    .from('revenue')
    .select('month, revenue');
  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
  return data as Revenue[];
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, amount, customers(name, email, image_url)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    amount: formatCurrency(row.amount),
    name: row.customers?.name ?? '',
    email: row.customers?.email ?? '',
    image_url: row.customers?.image_url ?? '',
  }));
}

export async function fetchCardData() {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .rpc('get_card_data', { _user_id: userId })
    .single();
  if (error || !data) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
  const row = data as {
    number_of_invoices: number;
    number_of_customers: number;
    total_paid: number;
    total_pending: number;
  };
  return {
    numberOfInvoices: Number(row.number_of_invoices ?? 0),
    numberOfCustomers: Number(row.number_of_customers ?? 0),
    totalPaidInvoices: formatCurrency(Number(row.total_paid ?? 0)),
    totalPendingInvoices: formatCurrency(Number(row.total_pending ?? 0)),
  };
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
): Promise<InvoicesTable[]> {
  const userId = await requireUserId();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const { data, error } = await supabaseAdmin.rpc('get_filtered_invoices', {
    _user_id: userId,
    q: query,
    page_offset: offset,
    page_limit: ITEMS_PER_PAGE,
  });

  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
  return (data ?? []) as InvoicesTable[];
}

export async function fetchInvoicesPages(query: string) {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin.rpc('get_invoices_count', {
    _user_id: userId,
    q: query,
  });
  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
  return Math.ceil(Number(data ?? 0) / ITEMS_PER_PAGE);
}

export async function fetchInvoiceById(id: string) {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, customer_id, amount, status')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
  if (!data) return undefined;

  const invoice: InvoiceForm = {
    id: data.id,
    customer_id: data.customer_id,
    amount: data.amount / 100,
    status: data.status,
  };
  return invoice;
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all customers.');
  }
  return (data ?? []) as CustomerField[];
}

export async function fetchFilteredCustomers(
  query: string,
): Promise<FormattedCustomersTable[]> {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin.rpc('get_filtered_customers', {
    _user_id: userId,
    q: query,
  });

  if (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer table.');
  }

  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    image_url: c.image_url,
    total_invoices: Number(c.total_invoices ?? 0),
    total_pending: formatCurrency(Number(c.total_pending ?? 0)),
    total_paid: formatCurrency(Number(c.total_paid ?? 0)),
  }));
}
