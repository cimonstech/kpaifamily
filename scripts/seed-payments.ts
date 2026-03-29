import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_RATE = 50

interface PaymentEntry {
  name: string
  amount: number
}

interface MonthData {
  month: string
  payments: PaymentEntry[]
}

interface Member {
  id: string
  name: string
  anonymous: boolean
  active: boolean
  start_date: string | null
  credit_balance: number
}

function findMember(name: string, members: Member[]): Member | null {
  const cleaned = name.trim().toLowerCase()

  const exact = members.find(m => m.name.toLowerCase() === cleaned)
  if (exact) return exact

  const partial = members.find(m =>
    m.name.toLowerCase().includes(cleaned) ||
    cleaned.includes(m.name.toLowerCase())
  )
  if (partial) return partial

  const words = cleaned.split(' ')
  const wordMatch = members.find(m => {
    const memberWords = m.name.toLowerCase().split(' ')
    return words.some(w => w.length > 3 && memberWords.includes(w))
  })
  return wordMatch || null
}

async function insertPayment(
  member: Member,
  amount: number,
  month: string,
  monthDate: Date,
  skipped: Array<{ month: string; name: string; reason: string }>,
  inserted: Array<{ month: string; name: string; amount: number }>
) {
  const { data: rates } = await supabase
    .from('member_rates')
    .select('rate, effective_from')
    .eq('member_id', member.id)
    .lte('effective_from', month + '-01')
    .order('effective_from', { ascending: false })
    .limit(1)

  const rate = rates?.[0]?.rate ?? DEFAULT_RATE

  const totalAvailable = amount + (member.credit_balance || 0)
  const monthsCovered = Math.floor(totalAvailable / rate)
  const creditRemainder = totalAvailable % rate
  const creditUsed = Math.min(
    member.credit_balance || 0,
    totalAvailable - creditRemainder
  )

  const lastDay = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  )
  const datePaid = lastDay.toISOString().slice(0, 10)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      member_id: member.id,
      amount,
      date_paid: datePaid,
      months_covered: Math.max(1, monthsCovered),
      credit_used: creditUsed,
      credit_remainder: creditRemainder,
      note: 'Historical import'
    })
    .select()
    .single()

  if (paymentError || !payment) {
    console.log(`  ❌ Failed to insert for ${member.name}:`, paymentError?.message)
    skipped.push({
      month,
      name: member.name,
      reason: 'DB insert failed: ' + paymentError?.message
    })
    return
  }

  const monthsToMark = Math.max(1, monthsCovered)
  for (let i = 0; i < monthsToMark; i++) {
    const targetMonth = new Date(monthDate)
    targetMonth.setMonth(targetMonth.getMonth() + i)
    const targetMonthStr =
      targetMonth.toISOString().slice(0, 7) + '-01'

    await supabase
      .from('monthly_checklist')
      .upsert(
        {
          member_id: member.id,
          month: targetMonthStr,
          paid: true,
          payment_id: payment.id
        },
        { onConflict: 'member_id,month' }
      )
  }

  member.credit_balance = creditRemainder

  inserted.push({ month, name: member.name, amount })
  console.log(`  ✔  ${member.name} — GHS ${amount}`)
}

async function main() {
  console.log('🚀 Starting payment seed script...\n')

  const dataPath = path.join(__dirname, 'payment-history.json')
  if (!fs.existsSync(dataPath)) {
    console.error('❌ payment-history.json not found in scripts/ folder')
    process.exit(1)
  }

  const rawData: MonthData[] = JSON.parse(
    fs.readFileSync(dataPath, 'utf-8')
  )

  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name, anonymous, active, start_date, credit_balance')
    .order('name')

  if (membersError || !members) {
    console.error('❌ Failed to fetch members:', membersError)
    process.exit(1)
  }

  console.log(`✅ Loaded ${members.length} members from database`)
  console.log(`📅 Processing ${rawData.length} months of data\n`)

  const skipped: Array<{ month: string; name: string; reason: string }> = []
  const inserted: Array<{ month: string; name: string; amount: number }> = []

  const sortedData = [...rawData].sort((a, b) =>
    a.month.localeCompare(b.month)
  )

  for (const monthData of sortedData) {
    const { month, payments } = monthData
    const monthDate = new Date(month + '-01')
    const monthName = monthDate.toLocaleDateString('en-GH', {
      month: 'long',
      year: 'numeric'
    })

    console.log(`\n📅 ${monthName} (${payments.length} entries)...`)

    for (const entry of payments) {
      const nameLower = entry.name.trim().toLowerCase()

      if (
        nameLower === 'anonymous' ||
        nameLower === 'anonymous 2' ||
        nameLower.startsWith('anonymous')
      ) {
        console.log(`  ⏭️  Skipping Anonymous — admin will enter manually`)
        skipped.push({
          month: monthName,
          name: entry.name,
          reason: 'Anonymous — admin will enter manually'
        })
        continue
      }

      const member = findMember(entry.name, members)

      if (!member) {
        console.log(`  ⚠️  No match for "${entry.name}" — skipping`)
        skipped.push({
          month: monthName,
          name: entry.name,
          reason: 'No matching member found'
        })
        continue
      }

      if (member.start_date) {
        const startDate = new Date(member.start_date)
        if (monthDate < startDate) {
          console.log(
            `  ⚠️  ${member.name} not active in ${monthName} — skipping`
          )
          skipped.push({
            month: monthName,
            name: entry.name,
            reason: `Start date is ${member.start_date}`
          })
          continue
        }
      }

      if (member.name !== entry.name.trim()) {
        console.log(
          `  ℹ️  "${entry.name}" matched to "${member.name}"`
        )
      }

      await insertPayment(
        member,
        entry.amount,
        month,
        monthDate,
        skipped,
        inserted
      )
    }
  }

  console.log('\n💾 Updating member credit balances...')
  for (const member of members) {
    const { data: lastPayment } = await supabase
      .from('payments')
      .select('credit_remainder')
      .eq('member_id', member.id)
      .order('date_paid', { ascending: false })
      .limit(1)

    if (lastPayment && lastPayment.length > 0) {
      await supabase
        .from('members')
        .update({ credit_balance: lastPayment[0].credit_remainder })
        .eq('id', member.id)
    }
  }

  const { data: finalPayments } = await supabase
    .from('payments')
    .select('amount')

  const grandTotal =
    finalPayments?.reduce((s, p) => s + Number(p.amount), 0) || 0

  console.log('\n' + '='.repeat(50))
  console.log('📊 SEED SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Payments inserted: ${inserted.length}`)
  console.log(`⏭️  Skipped: ${skipped.length}`)

  if (skipped.length > 0) {
    console.log('\n⚠️  SKIPPED ENTRIES:')
    console.log('-'.repeat(50))
    skipped.forEach(s => {
      console.log(`  [${s.month}] ${s.name} — ${s.reason}`)
    })
  }

  console.log(
    `\n💰 Grand total in database: GHS ${grandTotal.toLocaleString()}`
  )
  console.log('\n✅ Done!')
}

main().catch(console.error)