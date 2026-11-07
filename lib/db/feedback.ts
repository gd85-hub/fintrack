import { Platform } from 'react-native';

import { appVersionString } from '../appVersion';
import { supabase } from '../supabase';

export async function submitFeedback(
  message: string,
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('feedback').insert({
      message: message.trim(),
      app_version: appVersionString(),
      platform: Platform.OS,
    });
    return { error };
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error('Unable to submit feedback.'),
    };
  }
}
