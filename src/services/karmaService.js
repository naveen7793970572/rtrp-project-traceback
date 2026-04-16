import { db } from './firebase'
import { doc, updateDoc, increment } from 'firebase/firestore'

export async function awardKarma(uid, points) {
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, { karma: increment(points) })
}
