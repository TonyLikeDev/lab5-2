import bcrypt from 'bcryptjs';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';
import { supabaseAdmin } from '../lib/supabase';

async function seedUsers() {
  const rows = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: await bcrypt.hash(u.password, 10),
    })),
  );
  const { error } = await supabaseAdmin
    .from('users')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

async function seedCustomers() {
  const { error } = await supabaseAdmin
    .from('customers')
    .upsert(customers, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

async function seedInvoices() {
  const { error } = await supabaseAdmin
    .from('invoices')
    .insert(invoices);
  if (error && error.code !== '23505') throw error;
}

async function seedRevenue() {
  const { error } = await supabaseAdmin
    .from('revenue')
    .upsert(revenue, { onConflict: 'month', ignoreDuplicates: true });
  if (error) throw error;
}

export async function GET() {
  try {
    await seedUsers();
    await seedCustomers();
    await seedInvoices();
    await seedRevenue();
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error: any) {
    console.error('Seed error:', error);
    return Response.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
