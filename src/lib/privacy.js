// Single place for the data-retention promise shown wherever a patient types
// their e-mail (booking form, waitlist, "Quero reagendar"). Keep it in sync
// with whatever cleanup the backend actually runs.
export const DATA_RETENTION_MONTHS = 24

export const PRIVACY_CONTACT_EMAIL = 'contato@mulherviva.org'

export const RETENTION_NOTICE =
  `Usamos seu e-mail apenas para confirmar, lembrar e permitir reagendar ou cancelar a consulta. ` +
  `Ele fica guardado por até ${DATA_RETENTION_MONTHS} meses após a última consulta. ` +
  `Para pedir a exclusão dos seus dados antes disso, escreva para ${PRIVACY_CONTACT_EMAIL}.`
