import { Swal, escapeSwalHtml } from '@/lib/ui/swal';
import type { CreateCaseFormFieldIssue } from '@/lib/validations/create-case-form.validation';

/**
 * Muestra en SweetAlert2 todos los fallos del formulario de creación de trámite.
 */
export async function showCreateCaseValidationSwal(
  issues: CreateCaseFormFieldIssue[]
): Promise<void> {
  if (!issues.length) return;

  const listHtml = issues
    .map(
      (i) =>
        `<li style="margin-bottom:10px;text-align:left"><strong>${escapeSwalHtml(i.label)}</strong><br/><span style="color:#374151">${escapeSwalHtml(i.message)}</span></li>`
    )
    .join('');

  await Swal.fire({
    icon: 'warning',
    title: 'Revise el formulario antes de enviar',
    html: `<p style="text-align:left;margin:0 0 12px;font-size:14px;color:#4b5563">Complete o corrija lo siguiente y vuelva a pulsar «Crear y enviar a revisión»:</p><ul style="margin:0;padding-left:1.25rem;font-size:14px">${listHtml}</ul>`,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#2563eb',
    width: '32rem',
  });
}
