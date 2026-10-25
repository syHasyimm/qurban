import "dotenv/config";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 });
const rollback = new Error("ROLLBACK_SCHEMA_CHECK_FIXTURES");
const fixtureId = `schema-check-${randomUUID()}`;
let checks = 0;

try {
  await db
    .begin(async (tx) => {
      await tx`set local statement_timeout = '10s'`;
      await tx`set local lock_timeout = '3s'`;

      async function rejects(label, operation, code, constraint) {
        await assert.rejects(
          tx.savepoint(operation),
          (error) =>
            error.code === code &&
            (!constraint || error.constraint_name === constraint),
          label,
        );
        checks++;
      }

      await tx`insert into "user" (id, name, email) values
        (${fixtureId}, 'Schema fixture', ${`${fixtureId}@example.test`}),
        (${`${fixtureId}-ordinary`}, 'Non-admin fixture', ${`${fixtureId}-ordinary@example.test`})`;
      await tx`insert into committee_admins (user_id) values (${fixtureId})`;

      const insertPeriod = (s, overrides = {}) => s`
        insert into qurban_periods ${s({
          name: fixtureId,
          hijri_year: randomInt(100000, 1000000000),
          registration_starts_on: "2030-01-01",
          registration_ends_on: "2030-03-01",
          payment_due_on: "2030-04-01",
          qurban_on: "2030-05-01",
          status: "open",
          created_by: fixtureId,
          ...overrides,
        })} returning *`;
      const [period] = await insertPeriod(tx);
      const [otherPeriod] = await insertPeriod(tx);

      await rejects(
        "Payment deadline cannot precede registration closing",
        (s) => insertPeriod(s, { payment_due_on: "2029-01-01" }),
        "23514",
        "qurban_periods_dates_ordered",
      );
      await rejects(
        "One period per Hijri year",
        (s) => insertPeriod(s, { hijri_year: period.hijri_year }),
        "23505",
        "qurban_periods_hijri_year_unique",
      );
      await rejects(
        "Draft periods cannot be featured publicly",
        (s) => insertPeriod(s, { status: "draft", is_featured: true }),
        "23514",
        "qurban_periods_featured_is_published",
      );
      const [featured] = await tx`
        select exists(select 1 from qurban_periods where is_featured) as present`;
      if (!featured.present) {
        await tx`update qurban_periods set is_featured = true where id = ${period.id}`;
      }
      await rejects(
        "Only one period is featured",
        (s) => insertPeriod(s, { is_featured: true }),
        "23505",
        "qurban_periods_one_featured_idx",
      );

      const insertParticipant = (s, overrides = {}) => s`
        insert into participants ${s({
          full_name: fixtureId,
          phone: "+6281234567890",
          created_by: fixtureId,
          ...overrides,
        })} returning *`;
      await rejects(
        "An auth user alone is not a committee administrator",
        (s) => insertParticipant(s, { created_by: `${fixtureId}-ordinary` }),
        "23503",
      );
      const people = [];
      for (let i = 0; i < 8; i++) {
        const [person] = await insertParticipant(tx);
        people.push(person);
      }
      assert.equal(people.length, 8, "Family members may share a phone number");
      checks++;

      const insertGroup = (s, overrides = {}) => s`
        insert into qurban_groups ${s({
          period_id: period.id,
          code: randomUUID(),
          estimated_total: "28000000",
          created_by: fixtureId,
          ...overrides,
        })} returning *`;
      const [group] = await insertGroup(tx);
      const [otherGroup] = await insertGroup(tx, { period_id: otherPeriod.id });
      for (const expected_members of [0, 8]) {
        await rejects(
          "A cow has between one and seven shares",
          (s) => insertGroup(s, { expected_members }),
          "23514",
          "qurban_groups_member_limit",
        );
      }
      await rejects(
        "Ready status requires a locked final budget",
        (s) => insertGroup(s, { status: "ready" }),
        "23514",
        "qurban_groups_ready_price_locked",
      );

      const insertRegistration = (s, overrides = {}) => s`
        insert into qurban_registrations ${s({
          period_id: period.id,
          participant_id: people[7].id,
          registration_number: randomUUID(),
          qurban_name: "Schema fixture",
          group_id: group.id,
          slot_number: 1,
          created_by: fixtureId,
          ...overrides,
        })} returning *`;
      const registrations = [];
      for (let i = 0; i < 7; i++) {
        const [registration] = await insertRegistration(tx, {
          participant_id: people[i].id,
          slot_number: i + 1,
        });
        registrations.push(registration);
      }
      checks++;
      await rejects(
        "An eighth slot cannot exist",
        (s) => insertRegistration(s, { slot_number: 8 }),
        "23514",
        "qurban_registrations_slot_range",
      );
      await rejects(
        "An occupied slot cannot be reused",
        (s) => insertRegistration(s),
        "23505",
        "qurban_registrations_active_slot_unique",
      );
      await rejects(
        "A registration cannot join another period's cow",
        (s) => insertRegistration(s, { group_id: otherGroup.id }),
        "23503",
        "qurban_registrations_group_period_fk",
      );
      await rejects(
        "A group assignment requires a slot",
        (s) => insertRegistration(s, { slot_number: null }),
        "23514",
        "qurban_registrations_group_slot_pair",
      );
      await rejects(
        "A participant cannot register twice in the same period",
        (s) =>
          insertRegistration(s, {
            participant_id: people[0].id,
            group_id: null,
            slot_number: null,
          }),
        "23505",
        "qurban_registrations_person_period_unique",
      );
      await insertRegistration(tx, {
        participant_id: people[0].id,
        period_id: otherPeriod.id,
        group_id: null,
        slot_number: null,
      });
      checks++;
      await rejects(
        "A cancellation needs an actor, timestamp and reason",
        (s) => s`update qurban_registrations set status = 'cancelled'
          where id = ${registrations[6].id}`,
        "23514",
        "qurban_registrations_cancellation_complete",
      );
      await tx`update qurban_registrations
        set status = 'cancelled', cancelled_at = now(),
          cancelled_by = ${fixtureId}, cancellation_reason = 'Fixture cancellation'
        where id = ${registrations[6].id}`;
      await insertRegistration(tx, { slot_number: 7 });
      const [occupancy] = await tx`select count(*)::int as total
        from qurban_registrations where group_id = ${group.id} and status = 'active'`;
      assert.equal(occupancy.total, 7, "A cancelled seat can be reassigned");
      checks++;

      const insertCash = (s, overrides = {}) => s`
        insert into cash_transactions ${s({
          registration_id: registrations[0].id,
          entry_type: "deposit",
          amount: "500000",
          receipt_number: randomUUID(),
          idempotency_key: randomUUID(),
          recorded_by: fixtureId,
          ...overrides,
        })} returning *`;
      const [deposit] = await insertCash(tx);
      const [secondDeposit] = await insertCash(tx, { amount: "1500000" });
      await insertCash(tx, { entry_type: "refund", amount: "100000" });
      for (const amount of ["0", "-1"]) {
        await rejects(
          "Cash amounts must be positive",
          (s) => insertCash(s, { amount }),
          "23514",
          "cash_transactions_amount_positive",
        );
      }
      await rejects(
        "Cash is the only accepted method",
        (s) => insertCash(s, { payment_method: "transfer" }),
        "23514",
        "cash_transactions_cash_only",
      );
      await rejects(
        "A retried request cannot duplicate a receipt",
        (s) => insertCash(s, { idempotency_key: deposit.idempotency_key }),
        "23505",
        "cash_transactions_idempotency_key_unique",
      );
      await rejects(
        "Receipt numbers are unique",
        (s) => insertCash(s, { receipt_number: deposit.receipt_number }),
        "23505",
        "cash_transactions_receipt_number_unique",
      );
      await rejects(
        "Amounts cannot be edited after posting",
        (s) =>
          s`update cash_transactions set amount = 1 where id = ${deposit.id}`,
        "23000",
      );
      await rejects(
        "Cash records cannot be deleted",
        (s) => s`delete from cash_transactions where id = ${deposit.id}`,
        "23000",
      );
      await rejects(
        "A registration with payments cannot be deleted",
        (s) =>
          s`delete from qurban_registrations where id = ${registrations[0].id}`,
        "23503",
      );
      await rejects(
        "Voiding requires a reason",
        (s) => s`update cash_transactions
          set voided_at = clock_timestamp(), voided_by = ${fixtureId}
          where id = ${secondDeposit.id}`,
        "23514",
        "cash_transactions_void_complete",
      );
      await tx`update cash_transactions
        set voided_at = clock_timestamp(), voided_by = ${fixtureId},
          void_reason = 'Fixture clerical correction'
        where id = ${secondDeposit.id}`;
      await rejects(
        "Voided transactions cannot be restored",
        (s) => s`update cash_transactions
          set voided_at = null, voided_by = null, void_reason = null
          where id = ${secondDeposit.id}`,
        "23000",
      );
      await rejects(
        "New transactions cannot be pre-voided",
        (s) =>
          insertCash(s, {
            voided_at: new Date(),
            voided_by: fixtureId,
            void_reason: "Invalid initial state",
          }),
        "23000",
      );
      const [balance] = await tx`
        select sum(case when entry_type = 'deposit' then amount else -amount end)::text as net
        from cash_transactions
        where registration_id = ${registrations[0].id} and voided_at is null`;
      assert.equal(
        balance.net,
        "400000",
        "Refunds and voids affect the net contribution",
      );
      checks++;

      const [log] = await tx`insert into audit_logs
        (actor_id, period_id, action, entity_type, entity_id)
        values (${fixtureId}, ${period.id}, 'schema_check', 'registration', ${registrations[0].id})
        returning id`;
      await rejects(
        "Audit records cannot be changed",
        (s) => s`update audit_logs set action = 'changed' where id = ${log.id}`,
        "23000",
      );
      await rejects(
        "Audit records cannot be deleted",
        (s) => s`delete from audit_logs where id = ${log.id}`,
        "23000",
      );

      // Throwing from begin() rolls back ALL fixtures, including successful writes.
      throw rollback;
    })
    .catch((error) => {
      if (error !== rollback) throw error;
    });

  const [remaining] =
    await db`select count(*)::int as total from "user" where id = ${fixtureId}`;
  assert.equal(remaining.total, 0, "All fixtures were rolled back");
  checks++;
  console.log(`${checks} database checks passed; all fixtures rolled back.`);
} finally {
  await db.end();
}
