/** true = datos quemados en memoria (sin PostgreSQL). Poner "false" cuando la BD esté lista. */
export function usaDatosQuemadosHbi(): boolean {
  return process.env.NEXT_PUBLIC_HBI_MOCK_DATA !== 'false';
}
