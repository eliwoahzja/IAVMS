import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const database = process.env.TEST_PG_URL
if (!database) throw new Error('TEST_PG_URL must point to a disposable test database')

const user = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const targetDate = '2030-01-07'

async function sql(query) {
  try {
    const { stdout } = await exec('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', database, '-c', query])
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    return { ok: false, output: String(error.stderr ?? error.message).slice(0, 1200) }
  }
}
async function requireSuccess(query, label) {
  const result = await sql(query)
  assert.equal(result.ok, true, label + ': ' + result.output)
  return result.output
}
async function requireFailure(query, label) {
  const result = await sql(query)
  assert.equal(result.ok, false, label + ': expected a database rejection')
}

const insert = (n, teacher, time, status = 'Pending') =>
  `insert into public.appointments(requester_id,requester_name,requester_email,requester_type,department,teacher_name,date,"time",purpose,status)
values ('${user(n)}','Test user ${n}','fixture${n}@invalid.example','student','College of IT',${teacher === null ? 'null' : "'" + teacher + "'"},'${targetDate}','${time}','Integration test','${status}') returning id`

test('transactions serialize same-teacher approvals while allowing separate teachers', async () => {
  const first = await requireSuccess(insert(1,'Ms. Juvy Ilustrisimo','9:00 AM'), 'first pending')
  const second = await requireSuccess(insert(2,'Ms. Juvy Ilustrisimo','9:00 AM'), 'second pending')
  const [a,b] = await Promise.all([
    sql(`update public.appointments set status='Approved' where id=${Number(first)}`),
    sql(`update public.appointments set status='Approved' where id=${Number(second)}`),
  ])
  assert.equal([a,b].filter((r) => r.ok).length, 1, 'only one simultaneous approval should commit: ' + JSON.stringify([a,b]))
  assert.equal(await requireSuccess(`select count(*) from public.appointments where date='${targetDate}' and "time"='9:00 AM' and status='Approved'`, 'same-teacher count'), '1')

  const third = await requireSuccess(insert(3,'Ms. Juvy Ilustrisimo','10:00 AM'), 'third pending')
  const fourth = await requireSuccess(insert(4,'Mr. Febrick Quiza','10:00 AM'), 'fourth pending')
  const separate = await Promise.all([
    sql(`update public.appointments set status='Approved' where id=${Number(third)}`),
    sql(`update public.appointments set status='Approved' where id=${Number(fourth)}`),
  ])
  assert.ok(separate.every((r) => r.ok), 'different teachers should independently accept bookings: ' + JSON.stringify(separate))
  assert.equal(await requireSuccess(`select count(*) from public.appointments where date='${targetDate}' and "time"='10:00 AM' and status='Approved'`, 'multi-teacher count'), '2')

  await requireFailure(`insert into public.blocked_slots (department,date,"time",reason) values ('College of IT','${targetDate}','10:00 AM','test closure')`, 'global occupied block')
  await requireFailure(`insert into public.teacher_blocked_slots (department,teacher_name,date,"time",reason) values ('College of IT','Ms. Juvy Ilustrisimo','${targetDate}','10:00 AM','test closure')`, 'teacher occupied block')
  await requireFailure(`delete from public.teacher_availability where department='College of IT' and teacher_name='Mr. Febrick Quiza' and weekday=1 and "time"='10:00 AM'`, 'occupied teacher weekly slot')
  await requireFailure(`delete from public.availability where department='College of IT' and weekday=1 and "time"='10:00 AM'`, 'occupied department weekly slot')
  await requireFailure("update public.departments set active=false where name='College of IT'", 'deactivate occupied office')

  const legacy = await requireSuccess(insert(5,null,'11:00 AM','Approved'), 'legacy department reservation')
  await requireFailure(insert(6,'Ms. Angelica Perioles','11:00 AM','Approved'), 'legacy reservation excludes teacher booking')
  await requireSuccess(`update public.appointments set status='Cancelled' where id=${Number(legacy)}`, 'cancel legacy')

  await requireSuccess(`update public.appointments set status='Cancelled' where id in (${Number(third)},${Number(fourth)})`, 'release teacher bookings')
  await requireSuccess(`insert into public.blocked_slots (department,date,"time",reason) values ('College of IT','${targetDate}','10:00 AM','test closure')`, 'block now-free slot')
  await requireFailure(insert(7,'Mr. Ralph Baga','10:00 AM'), 'cannot request globally blocked slot')
})
