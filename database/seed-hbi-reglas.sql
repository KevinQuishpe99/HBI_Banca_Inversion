-- Reglas de notificación / motor operativo HBI (documento Mayo 2026)
INSERT INTO reglas_notificacion_hbi (fase, tipo_servicio, codigo_regla, titulo, mensaje_plantilla, orden)
VALUES
  ('FASE_1_CONTRATOS', NULL, 'F1_DOC_FALTA', 'Documentación pendiente',
   'Cargue el paquete contractual del crédito e identifique Anexos 1, 2 y 3.', 1),
  ('FASE_2_CORREOS', NULL, 'F2_CORREO_FALTA', 'Bandeja vacía',
   'Registre correos de Agente–HBI, Deudor y Acreedores en la operación.', 2),
  ('FASE_3_EXPEDIENTE', NULL, 'F3_EXPEDIENTE', 'Consolidar expediente',
   'Revise la vista 360: contractual, cronogramas, comunicaciones y responsables.', 3),
  ('FASE_4_SEGUIMIENTO', 'ANEXO_1_ADMINISTRATIVO', 'F4_A1_PEND', 'Anexo 1 pendiente',
   'Complete actividades del Agente Administrativo.', 4),
  ('FASE_4_SEGUIMIENTO', 'ANEXO_2_GARANTIAS', 'F4_A2_PEND', 'Anexo 2 pendiente',
   'Complete actividades del Agente de Garantías.', 5),
  ('FASE_4_SEGUIMIENTO', 'ANEXO_3_CALCULO', 'F4_A3_PEND', 'Anexo 3 pendiente',
   'Complete actividades del Agente de Cálculo.', 6)
ON CONFLICT (codigo_regla) DO NOTHING;
