'use server'

import { slotStates as getSlots, book as submitBooking, decide as decideBooking, cancel as cancelBooking } from '@/lib/actions/appointments'
import { registerVisitor as createVisitor, markVisit as updateVisitor } from '@/lib/actions/visitors'
import { toggleSlot as setSlot, blockSlot as closeSlot, unblockSlot as openSlot, saveOffice as updateOffice } from '@/lib/actions/offices'
import { setUserRole as updateRole, setAuthorized as updateAuthorization } from '@/lib/actions/users'
import { signIn as performSignIn, signUp as performSignUp, signOut as performSignOut } from '@/lib/actions/auth'
import type { Role } from '@/lib/types'

export async function slotStates(department: string, date: string) {
  return getSlots(department, date)
}
export async function book(input: { department: string; date: string; time: string; purpose: string }) {
  return submitBooking(input)
}
export async function decide(id: number, action: 'approve' | 'reject' | 'reschedule', to?: { date: string; time: string }) {
  return decideBooking(id, action, to)
}
export async function cancel(id: number) {
  return cancelBooking(id)
}
export async function registerVisitor(input: { name: string; purpose: string; department: string; appointmentId: number | null }) {
  return createVisitor(input)
}
export async function markVisit(id: number, field: 'arrived_at' | 'left_at') {
  return updateVisitor(id, field)
}
export async function toggleSlot(department: string, day: number, time: string, on: boolean) {
  return setSlot(department, day, time, on)
}
export async function blockSlot(department: string, date: string, time: string | null, reason: string) {
  return closeSlot(department, date, time, reason)
}
export async function unblockSlot(id: number) {
  return openSlot(id)
}
export async function saveOffice(name: string, active: boolean) {
  return updateOffice(name, active)
}
export async function setUserRole(userId: string, role: Role, department: string) {
  return updateRole(userId, role, department)
}
export async function setAuthorized(userId: string, on: boolean) {
  return updateAuthorization(userId, on)
}
export async function signIn(fd: FormData) {
  return performSignIn(fd)
}
export async function signUp(fd: FormData) {
  return performSignUp(fd)
}
export async function signOut() {
  return performSignOut()
}
