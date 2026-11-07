import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type DeleteAccountError =
  | 'config'
  | 'delete_failed'
  | 'method_not_allowed'
  | 'unauthorized';

type DeleteAccountResponse =
  | { ok: true }
  | { ok: false; error: DeleteAccountError };

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function response(payload: DeleteAccountResponse) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: corsHeaders,
  });
}

function failure(error: DeleteAccountError): DeleteAccountResponse {
  return { ok: false, error };
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  const token = match?.[1]?.trim();
  return token || null;
}

export async function handleDeleteAccountRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return response({ ok: true });
  }

  if (request.method !== 'POST') {
    return response(failure('method_not_allowed'));
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('delete-account: missing Supabase configuration');
    return response(failure('config'));
  }

  const jwt = bearerToken(request);
  if (!jwt) {
    return response(failure('unauthorized'));
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await adminClient.auth.getUser(jwt);
    if (error || !data.user) {
      if (error) {
        console.error(
          'delete-account: unable to authenticate caller',
          error.message,
        );
      }
      return response(failure('unauthorized'));
    }

    try {
      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(data.user.id);
      if (deleteError) {
        console.error(
          'delete-account: admin deletion failed',
          deleteError.message,
        );
        return response(failure('delete_failed'));
      }
    } catch (error: unknown) {
      console.error('delete-account: admin deletion threw', error);
      return response(failure('delete_failed'));
    }

    return response({ ok: true });
  } catch (error: unknown) {
    console.error('delete-account: caller authentication threw', error);
    return response(failure('unauthorized'));
  }
}

Deno.serve(handleDeleteAccountRequest);
