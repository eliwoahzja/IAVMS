'use server'

export { slotStates, book, decide, cancel } from '@/lib/actions/appointments'
export { registerVisitor, markVisit } from '@/lib/actions/visitors'
export { toggleSlot, blockSlot, unblockSlot, saveOffice } from '@/lib/actions/offices'
export { setUserRole, setAuthorized } from '@/lib/actions/users'
export { signIn, signUp, signOut } from '@/lib/actions/auth'
