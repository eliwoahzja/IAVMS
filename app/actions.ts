'use server'

import { slotStates as getSlots, book as submitBooking, decide as decideBooking, cancel as cancelBooking } from '@/lib/actions/appointments'
import { registerVisitor as createVisitor, markVisit as updateVisitor } from '@/lib/actions/visitors'
import { toggleSlot as setSlot, blockSlot as closeSlot, unblockSlot as openSlot, saveOffice as updateOffice, toggleTeacherSlot as setTeacherSlot, blockTeacherSlot as closeTeacherSlot, unblockTeacherSlot as openTeacherSlot } from '@/lib/actions/offices'
import { setUserRole as updateRole, setAuthorized as updateAuthorization, deleteAccount as removeAccount } from '@/lib/actions/users'
import { signIn as performSignIn, requestActivation as performRequestActivation, signOut as performSignOut, setPassword as performSetPassword } from '@/lib/actions/auth'
import { reviewAccess, resendActivation } from '@/lib/actions/access-requests'
import { sendDiagnosticEmail } from '@/lib/actions/email-diagnostics'
import type { Role } from '@/lib/types'

export async function slotStates(department: string, date: string, teacherName?: string | null) {
  return getSlots(department, date, teacherName)
}
export async function book(input: { department: string; teacher_name?: string | null; date: string; time: string; purpose: string }) {
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
export async function deleteAccount(userId: string) {
  return removeAccount(userId)
}
export async function signIn(fd: FormData) {
  return performSignIn(fd)
}
export async function requestActivation(fd: FormData) {
  return performRequestActivation(fd)
}
export async function signOut() {
  return performSignOut()
}

export async function setPassword(fd: FormData) {
  return performSetPassword(fd)
}
export async function reviewAccessRequest(id: string, action: 'approve' | 'reject') {
  return reviewAccess(id, action)
}

export async function resendActivationEmail(id: string) {
  return resendActivation(id)
}

export async function testAdminEmail() {
  return sendDiagnosticEmail()
}

export async function toggleTeacherSlot(teacher: string, weekday: number, time: string, on: boolean) {
  return setTeacherSlot(teacher, weekday, time, on)
}
export async function blockTeacherSlot(teacher: string, date: string, time: string | null, reason: string) {
  return closeTeacherSlot(teacher, date, time, reason)
}
export async function unblockTeacherSlot(id: number) {
  return openTeacherSlot(id)
}
