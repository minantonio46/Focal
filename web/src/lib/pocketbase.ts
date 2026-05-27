import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)

// 자동 로그인 (Superuser)
export async function initAuth() {
  if (!pb.authStore.isValid) {
    await pb.collection('_superusers').authWithPassword(
      import.meta.env.VITE_PB_EMAIL,
      import.meta.env.VITE_PB_PASSWORD,
    )
  }
}

export default pb
