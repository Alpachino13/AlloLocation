import { supabase } from './supabase'

export async function envoyerNotification({
  userId, titre, message, type
}: {
  userId: string
  titre: string
  message: string
  type?: string
}) {
  await supabase.from('notifications').insert({
    user_id: userId,
    titre,
    message,
    type: type ?? 'info',
  })
}