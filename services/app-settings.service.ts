import { query } from '@/lib/db';

const KEY = 'amount_alert_threshold';

export async function getAmountAlertThreshold(): Promise<number> {
  const r = await query<{ valor_numerico: string }>(
    `SELECT valor_numerico::text AS valor_numerico FROM configuracion_app WHERE clave = $1`,
    [KEY]
  );
  const raw = r.rows[0]?.valor_numerico;
  if (raw == null || raw === '') return 100000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 100000;
}

export async function setAmountAlertThreshold(value: number): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('El umbral debe ser un número mayor que cero');
  }
  await query(
    `INSERT INTO configuracion_app (clave, valor_numerico, actualizado_en)
     VALUES ($1, $2, NOW())
     ON CONFLICT (clave) DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, actualizado_en = NOW()`,
    [KEY, value]
  );
}

// ── Alertas por fecha límite ──────────────────────────────────────────────────

export interface DeadlineAlertConfig {
  reminderDays: number;
  overdueEnabled: boolean;
  overdueRepeatDays: number;
}

const DL_DEFAULTS: DeadlineAlertConfig = {
  reminderDays: 2,
  overdueEnabled: true,
  overdueRepeatDays: 3,
};

async function getNumericSetting(key: string, fallback: number): Promise<number> {
  const r = await query<{ valor_numerico: string }>(
    `SELECT valor_numerico::text AS valor_numerico FROM configuracion_app WHERE clave = $1`,
    [key]
  );
  const raw = r.rows[0]?.valor_numerico;
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function setNumericSetting(key: string, value: number): Promise<void> {
  await query(
    `INSERT INTO configuracion_app (clave, valor_numerico, actualizado_en)
     VALUES ($1, $2, NOW())
     ON CONFLICT (clave) DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, actualizado_en = NOW()`,
    [key, value]
  );
}

export async function getDeadlineAlertConfig(): Promise<DeadlineAlertConfig> {
  const [reminderDays, overdueEnabled, overdueRepeatDays] = await Promise.all([
    getNumericSetting('deadline_reminder_days', DL_DEFAULTS.reminderDays),
    getNumericSetting('deadline_overdue_enabled', 1),
    getNumericSetting('deadline_overdue_repeat_days', DL_DEFAULTS.overdueRepeatDays),
  ]);
  return {
    reminderDays: Math.max(0, Math.round(reminderDays)),
    overdueEnabled: overdueEnabled >= 1,
    overdueRepeatDays: Math.max(1, Math.round(overdueRepeatDays)),
  };
}

export async function setDeadlineAlertConfig(cfg: DeadlineAlertConfig): Promise<void> {
  await Promise.all([
    setNumericSetting('deadline_reminder_days', Math.max(0, Math.round(cfg.reminderDays))),
    setNumericSetting('deadline_overdue_enabled', cfg.overdueEnabled ? 1 : 0),
    setNumericSetting('deadline_overdue_repeat_days', Math.max(1, Math.round(cfg.overdueRepeatDays))),
  ]);
}
