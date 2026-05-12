'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, auth } from '@/auth';
import { supabaseAdmin } from './supabase';
import bcrypt from 'bcryptjs';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated.');
  return session.user.id;
}

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoiceSchema = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const userId = await requireUserId();
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split('T')[0];

  const { error } = await supabaseAdmin.from('invoices').insert({
    customer_id: customerId,
    amount: amountInCents,
    status,
    date,
    user_id: userId,
  });

  if (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to Create Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const userId = await requireUserId();
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabaseAdmin
    .from('invoices')
    .update({
      customer_id: customerId,
      amount: amountInCents,
      status,
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const CustomerSchema = z.object({
  name: z.string().min(1, { message: 'Please enter a name.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  imageUrl: z
    .string()
    .url({ message: 'Please enter a valid image URL.' })
    .optional()
    .or(z.literal('')),
});

export type CustomerState = {
  errors?: {
    name?: string[];
    email?: string[];
    imageUrl?: string[];
  };
  message?: string | null;
};

export async function createCustomer(
  prevState: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const validatedFields = CustomerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    imageUrl: formData.get('imageUrl'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields.',
    };
  }

  const userId = await requireUserId();
  const { name, email, imageUrl } = validatedFields.data;
  const finalImageUrl =
    imageUrl && imageUrl.length > 0
      ? imageUrl
      : `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;

  const { error } = await supabaseAdmin.from('customers').insert({
    name,
    email,
    image_url: finalImageUrl,
    user_id: userId,
  });

  if (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to create customer.' };
  }

  revalidatePath('/dashboard/customers');
  redirect('/dashboard/customers');
}

export async function deleteInvoice(id: string) {
  const userId = await requireUserId();
  const { error } = await supabaseAdmin
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    throw new Error('Failed to delete invoice.');
  }
  revalidatePath('/dashboard/invoices');
}

const SignupSchema = z.object({
  name: z.string().min(1, { message: 'Please enter your name.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});

export type SignupState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string | null;
};

export async function signup(
  prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const validatedFields = SignupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing or invalid fields.',
    };
  }

  const { name, email, password } = validatedFields.data;

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return {
      errors: { email: ['An account with this email already exists.'] },
      message: 'Email already registered.',
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabaseAdmin
    .from('users')
    .insert({ name, email, password: hashedPassword });

  if (error) {
    console.error('Database Error:', error);
    return { message: 'Database Error: Failed to create account.' };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: 'Account created, but sign-in failed. Try logging in.' };
    }
    throw error;
  }

  return {};
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
