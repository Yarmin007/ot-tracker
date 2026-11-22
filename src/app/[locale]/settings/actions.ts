'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ProfileResult = { ok: true; signatureNotSaved?: boolean } | { ok: false; error: string };

const MAX_SIGNATURE_LENGTH = 400_000; // ~300 KB PNG as a data URL

/** True when the database hasn't got the signature column yet (migration not run). */
const missingSignatureColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST204' || error.code === '42703') && /signature/.test(error.message ?? '');

/** Save personal details (used by first-time onboarding and the Settings page). */
export async function saveProfile(formData: FormData): Promise<ProfileResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: 'unauthorized' };

  const fullName = String(formData.get('fullName') ?? '').trim();
  const designation = String(formData.get('designation') ?? '').trim();
  const cardNo = String(formData.get('cardNo') ?? '').trim();
  const salary = parseFloat(String(formData.get('salary') ?? ''));
  const signature = String(formData.get('signature') ?? '');

  if (!fullName || !designation || !cardNo || !Number.isFinite(salary) || salary < 0) {
    return { ok: false, error: 'required' };
  }
  if (signature && (!signature.startsWith('data:image/png;base64,') || signature.length > MAX_SIGNATURE_LENGTH)) {
    return { ok: false, error: 'Invalid signature image.' };
  }

  const fields: Record<string, unknown> = {
    full_name: fullName,
    designation,
    record_card_no: cardNo,
    basic_salary: salary,
    signature: signature || null,
    is_onboarded: true,
  };

  const save = async (values: Record<string, unknown>) => {
    // Update the existing row; insert one only if none exists yet.
    const { data: updated, error } = await supabase.from('profiles').update(values).eq('id', userId).select('id');
    if (error) return error;
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from('profiles').insert({ id: userId, ...values });
      return insertError;
    }
    return null;
  };

  let error = await save(fields);
  let signatureNotSaved = false;
  if (missingSignatureColumn(error)) {
    const { signature: _omit, ...withoutSignature } = fields;
    void _omit;
    signatureNotSaved = !!signature;
    error = await save(withoutSignature);
  }
  if (error) return { ok: false, error: error.message };

  revalidatePath('/[locale]', 'layout');
  return { ok: true, signatureNotSaved };
}
