import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Generate a deterministic, stable chatId that is identical for both participants.
 * Formula: `${itemId}_${[uid1, uid2].sort().join('_')}`
 * Sorting the UIDs ensures the ID is the same regardless of which user computes it.
 */
export function getChatId(itemId, uid1, uid2) {
    const sorted = [uid1, uid2].sort()
    return `${itemId}_${sorted[0]}_${sorted[1]}`
}

/**
 * Idempotent chat creation.
 * Checks if chat already exists first, then creates with setDoc if it doesn't.
 * This avoids permission issues with setDoc merge on existing docs.
 * Returns the deterministic chatId.
 */
export async function ensureChat(itemId, itemTitle, ownerUID, claimantUID) {
    const chatId = getChatId(itemId, ownerUID, claimantUID)
    const chatRef = doc(db, 'chats', chatId)

    try {
        const snap = await getDoc(chatRef)
        if (!snap.exists()) {
            // Create the chat doc — this is a CREATE operation in Firestore rules
            await setDoc(chatRef, {
                itemId,
                itemTitle: itemTitle ?? 'Untitled Item',
                participants: [ownerUID, claimantUID],
                status: 'active',
                createdAt: serverTimestamp(),
            })
        }
    } catch (err) {
        // If getDoc fails (permission-denied because doc doesn't exist), try creating directly
        console.warn('ensureChat: getDoc failed, attempting create:', err.code)
        await setDoc(chatRef, {
            itemId,
            itemTitle: itemTitle ?? 'Untitled Item',
            participants: [ownerUID, claimantUID],
            status: 'active',
            createdAt: serverTimestamp(),
        })
    }

    return chatId
}
