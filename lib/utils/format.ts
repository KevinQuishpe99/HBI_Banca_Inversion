/**
 * Formatea el número de trámite de "2026-000005" a "Trámite n° 05"
 * @param caseNumber - Número de trámite completo (ej: "2026-000005")
 * @returns Número de trámite formateado (ej: "Trámite n° 05")
 */
export function formatCaseNumber(caseNumber: string): string {
  // Extraer los últimos dígitos después del guion
  const parts = caseNumber.split('-');
  if (parts.length === 2) {
    // Obtener el número y eliminar ceros a la izquierda, pero mantener al menos 2 dígitos
    const number = parts[1];
    const numericValue = parseInt(number, 10);
    const formattedNumber = numericValue.toString().padStart(2, '0');
    return `Trámite n° ${formattedNumber}`;
  }
  // Si el formato no es el esperado, retornar el original
  return caseNumber;
}
