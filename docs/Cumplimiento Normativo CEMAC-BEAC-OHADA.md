# Cumplimiento normativo de FondosEG: CEMAC, BEAC y OHADA

| | |
|---|---|
| **Estado** | Borrador para revisión de la asesoría jurídica local. Nada de este plan está implementado. |
| **Fecha** | 2 de noviembre de 2026 |
| **Código revisado** | Rama `main`, commit `ef8e3fd` |
| **Vía elegida** | Socio autorizado (ver sección 6) |

> Este documento es un análisis técnico y normativo preparado con ayuda de IA. No es asesoramiento jurídico: las conclusiones legales deben ser confirmadas por un abogado local.

## 1. Conclusión

FondosEG tiene una buena base técnica, pero en el repositorio no consta ninguna licencia ni conexión con el sistema interoperable (GIMAC).

La aplicación está diseñada para guardar saldos de clientes, enviar dinero entre billeteras y mover efectivo a través de gestores. Si opera así con fondos reales, muy probablemente prestará servicios de pago en el sentido del art. 3 del Reglamento 04/18. Esa actividad exige licencia (art. 23), está prohibida sin ella (art. 79) y puede acarrear el cierre de oficio (art. 84). El aviso de los términos actuales, que indica que FondosEG no es una entidad autorizada, no resuelve el problema si es FondosEG quien presta el servicio.

**Situación actual:** el responsable del proyecto indica que FondosEG aún no mueve dinero real de clientes. Esto permite cerrar las brechas antes del lanzamiento y evita migrar saldos reales. La regla de este plan es no operar con dinero real hasta que el socio y el abogado autoricen el piloto de la fase 5. La publicidad sí es un punto inmediato, porque el art. 80 prohíbe dar a entender que se está habilitado aunque todavía no se mueva dinero.

## 2. Alcance y límites del análisis

- **Revisado:** el código y los documentos de este repositorio, y las webs y textos públicos citados en la sección 11.
- **No revisado:** documentos de la empresa, contratos, licencias que puedan existir fuera del repositorio y la base de datos de producción. Por eso, "no consta" significa que no aparece en el repositorio, no que no exista.
- **Dinero real:** el responsable del proyecto indicó el 2 de noviembre de 2026 que FondosEG aún no mueve dinero real de clientes. El dato no se verificó en la base de datos de producción.

### Fiabilidad de las fuentes

| Texto | Cómo se consultó |
|---|---|
| Reglamento 04/18 | Original escaneado de la BEAC. Se leyeron todas las páginas salvo la 1, 2, 13 y 16. |
| Instrucción 001/GR/2018 | Página 3 (arts. 2–4) leída sobre la imagen. Resto del texto leído con un OCR de mala calidad; conviene cotejar los arts. 5–19 con el original. |
| Instrucción 001/GR/2025 | Texto del original de la BEAC. Las fechas del calendario anexo parecen incoherentes y deben comprobarse. |
| Fichas de adhesión de GIMAC | Originales de GIMAC. |
| Informe de servicios de pago 2023 | Original de la BEAC. Los datos son de 2023 y pueden haber cambiado. |
| COBAC R-2019/01, R-2019/02, R-2023/01 y R-2024/01 | **Solo fuentes secundarias.** |
| Reglamentos 02/24 y 04/24 | **Solo fuentes secundarias.** |
| Actos Uniformes de OHADA | **Solo los resúmenes de la web de OHADA**, no los textos completos. |

### Lo que no se pudo localizar o confirmar

- El Reglamento 02/18 de cambios, citado en los textos legales de FondosEG.
- Los límites vigentes de cuentas y operaciones (arts. 18 y 40).
- El texto particular sobre emisión y gestión de dinero electrónico (art. 86).
- Las normas de la COBAC sobre externalización y distribuidores (arts. 62 y 66).
- El trámite nacional de licencia en Guinea Ecuatorial.
- Los requisitos de certificación técnica y la cuota de entrada de GIMAC. El enlace de certificación de su web devuelve error 404.

## 3. Qué regula cada órgano

| Órgano | Qué aporta a FondosEG |
|---|---|
| **CEMAC** | Marco general. Su web no ofrece textos específicos de pagos ni certificados, y remite a la BEAC y la COBAC. |
| **BEAC** | Normas técnicas, interoperabilidad y límites; emite un dictamen sobre la plataforma técnica (arts. 18, 19 y 25). |
| **COBAC** | Da el dictamen vinculante para la licencia, supervisa y fija las normas prudenciales y antiblanqueo (arts. 13–15, 23 y 57). |
| **Ministro de moneda y crédito** | Otorga la licencia en el Estado de implantación, en este caso Guinea Ecuatorial (arts. 2 y 23). |
| **GIMAC** | Opera la red interoperable GIMACPAY: gestiona la adhesión y la certificación técnica. |
| **OHADA** | Derecho de empresa y contabilidad. Guinea Ecuatorial es miembro, pero OHADA no certifica servicios de pago. |

## 4. Lo que FondosEG ya tiene

| Control | Dónde está | Limitación |
|---|---|---|
| Consentimiento registrado y liquidación atómica | `services/wallet-transfer.ts:250` | Cubre el envío entre billeteras |
| Reclamaciones con referencia, acuse y plazo de 15 días (art. 44) | `lib/compliance.ts`, `app/(dashboard)/compliance/page.tsx` | Confirmar si está disponible por varios canales en todo momento |
| Registro de eventos y saldos tras cada operación (art. 46) | `supabase/migrations/20260620_cemac_payment_compliance.sql` | Falta definir la conservación durante 10 años |
| Conciliación interna | `services/dashboard.ts:31` | Agrupa por periodos y no compara contra un banco |
| Operación en una sola divisa | `services/wallet-transfer.ts:250` | Falta la compensación por un sistema autorizado |
| Documento de identidad en envíos por gestor | `components/agent-transfer-modal.tsx:301` | Solo se vio la exigencia en el formulario; es opcional en `app/api/external/transfer/route.ts:29` |
| Términos, privacidad y marco de cumplimiento | `lib/legal-content.ts` | Falta identificar al operador y su licencia |

## 5. Lo que falta

### 5.1 Licencias y documentos

La columna "Con socio" indica quién asumiría cada requisito en la vía elegida. El reparto debe confirmarse en el contrato.

| Requisito | Base | En el repositorio | Con socio |
|---|---|---|---|
| Licencia propia, o acuerdo con una entidad autorizada | Arts. 5, 23 y 63 | No consta | Acuerdo con el socio |
| Licencia de dirigentes y comisario de cuentas | Art. 23 | No consta | Socio |
| Capital mínimo de 500 M FCFA si es licencia propia | R-2019/02, art. 2 (fuente secundaria) | No consta | No aplica a FondosEG |
| Cuenta de cantonnement en un banco de la CEMAC, con fondos depositados como tarde al día siguiente | Arts. 24 y 52–54 | No consta | Socio |
| Dictamen de la BEAC sobre la plataforma | Arts. 25–27 | No consta | Socio, a confirmar |
| Autorización del regulador de telecomunicaciones si se opera por móvil | Art. 26 | No consta | A confirmar |
| Empresa inscrita en el RCCM, con estatutos y cuentas OHADA | OHADA | No consta | FondosEG |
| Políticas KYC y antiblanqueo, con formación anual y conservación durante 10 años | Art. 57, R-2023/01 | Solo texto general | Ambos |
| Contrato con el cliente y aviso de cambios con un mes de antelación | Arts. 38 y 41 | Parcial | Ambos |
| Plan de continuidad con sitio de respaldo | Art. 46, fichas GIMAC | No consta | Ambos |
| Notificar a la COBAC la externalización | Arts. 60–62 | No consta | Socio, con datos de FondosEG |

### 5.2 Cambios en la aplicación

1. **Verificación de identidad:** el onboarding y el envío entre billeteras no piden documento, aunque la norma exige identificar con certeza a ordenante y beneficiario (arts. 38 y 57).
2. **Antiblanqueo:** no se encontró filtrado contra listas de sanciones (Reg. 04/24), alertas ni flujo de declaración de sospecha.
3. **Límites:** solo se vio un tope de 10 M por solicitud de pago (`lib/server/payment-requests-contract.ts:14`), no límites por cuenta u operación (art. 40).
4. **Conciliación diaria** contra la cuenta de cantonnement, con desglose por titular (arts. 49 y 54).
5. **Conservación de 10 años** de identificación y operaciones (art. 50).
6. **Interoperabilidad:** el código no menciona GIMAC, SYGMA, ISO 20022, IBAN ni el QR de la CEMAC. La Instrucción 001/GR/2018 exige interoperar y compensar los envíos en XAF por un sistema autorizado (arts. 2 y 7).
7. **Reportes mensuales a la BEAC** para emisores y entidades de transferencia (Instrucción 001/GR/2018, arts. 10–11).
8. **Revolut:** revisar los payouts de `lib/server/revolut.ts`, porque los establecimientos de pago operan dentro de la CEMAC y solo pueden recibir fondos del exterior (art. 12). No se comprobó si están activos en producción.
9. **Publicidad:** "Cumplimiento CEMAC" ya se retiró de `lib/marketing-content.ts`. Falta revisar el resto de textos públicos, porque el art. 80 prohíbe dar a entender que se está habilitado.
10. **Datos sensibles:** el esquema guarda el número de documento como texto simple (`supabase/schema.sql:17`). Cifrarlo es una recomendación técnica derivada de la confidencialidad del art. 46, y debe revisarse junto con la Ley 1/2016 de Guinea Ecuatorial.
11. **Seguridad (R-2024/01, fuentes secundarias):** autenticación reforzada, pruebas anuales de vulnerabilidad y plan de recuperación probado.

### 5.3 Certificados

| Certificado | ¿Es necesario? |
|---|---|
| Licencia de servicios de pago | Sí, salvo que se opere bajo una entidad autorizada |
| Certificación técnica GIMAC | Sí, para conectarse a GIMACPAY. Con socio, debería cubrirla él |
| EMV | Solo si se emiten tarjetas (Instrucción 001/GR/2018, art. 4) |
| PCI DSS | Las fichas de GIMAC no lo piden a establecimientos ni agregadores. Sería necesario en la práctica si se tratan datos de tarjeta (interpretación propia) |
| ISO 20022 | Solo si se conecta directamente con SYGMA o SYSTAC (Instrucción 001/GR/2025) |
| ISO 27001 | No se vio exigido en los textos consultados; es útil como respaldo |

## 6. Vías comparadas

| Vía | Qué implica | Límite |
|---|---|---|
| **1. Socio autorizado (elegida)** | FondosEG actúa como distribuidor o socio técnico de una entidad autorizada. | Los fondos y el servicio pasan a ser del socio, lo que cambia el modelo. Las funciones sustanciales solo pueden externalizarse en entidades autorizadas (art. 60). |
| 2. Establecimiento de pago propio | Control total y posibilidad de ser miembro de GIMAC. | Es lo más caro: capital, normas prudenciales y supervisión. Había solo 7 en la CEMAC a finales de 2023. |
| 3. Agregador GIMAC | Contrato con GIMAC y un banco de liquidación. | Solo facturas, remesas y recargas. No legaliza las billeteras propias ni da la condición de miembro. |

Referencia si se reconsidera la vía 2. El dossier GIMAC para establecimientos de pago incluye:

- Decisión de licencia y aprobación de dirigentes.
- Patrocinio de un banco participante directo en SYGMA.
- Pago de la cuota de entrada.
- Estados financieros de 3 años y plan de negocio trienal.
- Arquitectura técnica, cuestionario de sistemas y política de archivo.
- Plan de continuidad con sitio de respaldo.
- Procedimientos KYC y antiblanqueo.

## 7. Modelo con socio autorizado

**El mayor cambio es de arquitectura: el saldo oficial de cada cliente tendrá que estar en los libros del socio, no en `client_balances`.** Según el art. 63, para las operaciones sobre cuentas y dinero electrónico, el distribuidor recoge la orden y los documentos y se los pasa a la entidad autorizada, que ejecuta la operación. Hoy FondosEG liquida en su propia base de datos, y un administrador puede recargar saldo a un gestor (`app/api/agents/[id]/topup/route.ts`), algo que no encaja en este modelo.

| Se encarga el socio | Se queda FondosEG |
|---|---|
| Licencia y supervisión de la COBAC | Empresa inscrita en el RCCM y contabilidad OHADA |
| Cuenta de cantonnement y custodia de fondos | Recoger documentos KYC y firmar el contrato con el cliente (arts. 38, 57 y 63) |
| Ejecutar las operaciones y conectarse a GIMACPAY | App, API y canal de atención al cliente |
| Reportes a la BEAC y la COBAC | Registro de fraudes y reclamaciones, y aviso de operaciones sospechosas (art. 65) |
| Responder ante clientes y terceros (art. 64) | Mostrar el nombre, logo y dirección del socio (art. 64) |

Con esta vía, FondosEG no necesita los 500 M FCFA de capital, el cantonnement propio ni la adhesión directa a GIMAC. A cambio, la COBAC puede vetar o suspender su mandato (art. 66).

## 8. Plan de implementación

**Orden recomendado:** las fases 0 y 1 son las primeras y la 2 puede avanzar a la vez. La fase 3 necesita el contrato y la API del socio, la 4 corre en paralelo y la 5 llega al final.

### Fase 0: reducir el riesgo ahora

- [ ] No operar con dinero real hasta que el socio y el abogado autoricen el piloto de la fase 5 (arts. 79 y 84).
- [x] Quitar "Cumplimiento CEMAC" de `lib/marketing-content.ts` (art. 80).
- [ ] Revisar si la web pública presenta las billeteras o los envíos como un servicio ya disponible (art. 80).
- [ ] Confirmar que los payouts de Revolut están desactivados en producción hasta que el socio y el abogado los validen (art. 12).
- [ ] Constituir o completar la empresa operadora e incluir sus datos en `lib/legal-content.ts`.

### Fase 1: elegir socio y firmar

**Candidatos a verificar:**

- **BANGE con Muni Dinero:** el informe de la BEAC los cita como autorizados en 2023. No se encontró una API pública.
- **BGFIBank con BGFIMoney:** solo aparece en prensa.
- **GETESA Money:** aparece como proyecto relanzado; no se pudo confirmar su estado actual.

**Pedir a cada candidato:**

- [ ] Copia de su licencia o autorización y confirmación de que opera en GIMACPAY.
- [ ] Documentación de su API y un entorno de pruebas.
- [ ] Límites vigentes y requisitos de KYC.

**Incluir en el contrato:**

- [ ] Mandato de distribuidor y subdistribuidores autorizados, que solo pueden hacer efectivo y envíos (art. 63).
- [ ] Reparto de comisiones.
- [ ] Acceso de la COBAC a la información y control sobre el socio técnico o distribuidor (art. 15).
- [ ] Destino de los fondos si termina el contrato o el socio pierde la autorización (arts. 75, 77 y 78).

**Plazos y permisos:**

- [ ] Si la plataforma cuenta como solución técnica nueva, el socio debe informar antes a la COBAC, que tiene 3 meses para responder; su silencio equivale a aprobación (arts. 29 y 31).
- [ ] Si se opera por móvil, obtener además la autorización del regulador de telecomunicaciones (art. 26).

### Fase 2: lo que se puede construir ya

No depende del socio, aunque él deberá validar los criterios finales.

- [ ] **Identidad:** flujo con documento en `app/onboarding/page.tsx` y bloqueo de envíos si el cliente no está verificado, tanto en `services/wallet-transfer.ts` como en la base de datos.
- [ ] **API externa:** hacer obligatorios los documentos en `app/api/external/transfer/route.ts:29`.
- [ ] **Datos sensibles:** cifrar el número de documento (`supabase/schema.sql:17`).
- [ ] **Límites:** límites configurables por nivel de verificación, con valores provisionales.
- [ ] **Antiblanqueo:** filtrado contra listas de sanciones de la ONU al dar de alta y al operar, alertas, cola de revisión y aviso al socio sin informar al cliente afectado.
- [ ] **Registro del art. 65:** guardar fecha, importe, contraparte y motivo de cada fraude o reclamación.
- [ ] **Conservación de 10 años (art. 50):** evitar perder el vínculo con el usuario, que `compliance_events` pone a `NULL` si se borra.
- [ ] **Script de borrado:** revisar y bloquear en producción `supabase/reset_transactional_data.sql`. No se leyó su contenido; por su nombre parece borrar datos.
- [ ] **Contrato del cliente:** cubrir todas las cláusulas del art. 38 y el aviso de cambios con un mes de antelación (art. 41).
- [ ] **Moneda en SMS:** corregir la alerta que dice EUR en `services/sms.ts:89`, en una aplicación que opera en XAF.

### Fase 3: integración con el socio

Depende de la API y el contrato del socio, así que no conviene empezarla antes.

- [ ] Crear `modules/partner-payments`, con una interfaz para abrir cuentas, consultar saldo, enviar, ingresar y retirar. `lib/server/payments-provider.ts` sirve de base para firmas y webhooks, pero solo cubre cobros.
- [ ] Cambiar los puntos de liquidación, bastante concentrados en `lib/server/financial-operations.ts` y `lib/server/payment-requests.ts:195`.
- [ ] Cambiar el flujo de estados: cada orden queda pendiente hasta que el socio la confirme por webhook. Se pueden reutilizar la idempotencia y el outbox existentes.
- [ ] Convertir `client_balances` en una copia de solo lectura y eliminar las recargas manuales.
- [ ] Pasar a los gestores a subdistribuidores, cada uno con mandato y cuenta en los libros del socio.
- [ ] Sustituir la conciliación mensual de `app/api/dashboard/reconciliation/route.ts` por una diaria contra los extractos del socio.
- [ ] Separar o eliminar los saldos de prueba antes del piloto, para que ningún saldo sin dinero real pase al socio. No hace falta migrar saldos reales, porque FondosEG aún no los tiene.
- [ ] Adaptar `/pay/[id]`, la API pública y CasasEG (`docs/guia-integracion-casaseg-es.md`), porque un pago ya no se confirmaría al instante.

### Fase 4: seguridad y continuidad

Puede avanzar en paralelo y alimenta el expediente del socio. Los puntos de R-2024/01 vienen de fuentes secundarias, así que el socio debe confirmar los que exija a FondosEG.

- [ ] MFA obligatorio para administradores y personal (comprobar en Clerk).
- [ ] Control de cuentas con privilegios altos.
- [ ] Prueba anual de vulnerabilidades.
- [ ] Plan de recuperación probado con sitio de respaldo.
- [ ] Inventario de proveedores con la ubicación de los datos (Vercel, Supabase, Twilio, Clerk, Resend).
- [ ] Arquitectura y política de archivo documentadas.

### Fase 5: lanzamiento

- [ ] Primera operación con dinero real: piloto con el socio, pocos usuarios y límites bajos.
- [ ] Verificar a diario la conciliación, los reportes y las reclamaciones.
- [ ] Publicar en toda la aplicación un texto del tipo "Servicio de pago prestado por [socio]; FondosEG actúa como distribuidor", revisado por el abogado.
- [ ] Dar de alta a los gestores y ampliar el acceso por etapas.

## 9. Preguntas para el abogado local

1. ¿A partir de qué actividad empezaría FondosEG a prestar servicios de pago (arts. 3 y 79)? ¿Puede mantener la plataforma en funcionamiento con saldos de prueba y sin dinero real?
2. ¿Qué figura corresponde a FondosEG: distribuidor, socio técnico o ambas (arts. 14, 60 y 63)? ¿Pueden los gestores ser subdistribuidores?
3. ¿Pueden los integradores de la API, como CasasEG, seguir operando con este modelo sin ser distribuidores a su vez? El subdistribuidor no puede delegar (art. 63).
4. ¿Puede FondosEG registrar clientes y recoger sus datos antes de firmar con el socio?
5. ¿Cuáles son los límites vigentes y el texto aplicable al dinero electrónico (arts. 18, 40 y 86)?
6. ¿Qué normas de la COBAC regulan hoy la externalización y los distribuidores (arts. 62 y 66)?
7. ¿La integración exige información previa a la COBAC (art. 29) y autorización del regulador de telecomunicaciones (art. 26) en Guinea Ecuatorial?
8. ¿Cómo se tramita el proceso ante el ministro competente y el Consejo Nacional de Crédito en Guinea Ecuatorial (arts. 21 y 23)?
9. ¿Están vigentes y correctamente citados los Reglamentos 02/24 y 04/24, y COBAC R-2019/01, R-2019/02, R-2023/01 y R-2024/01? El art. 57 del Reglamento 04/18 todavía cita el 01/16, derogado por el 02/24 según fuentes secundarias.
10. ¿Cómo aplica el régimen de cambios (Reg. 02/18) a los payouts de Revolut?
11. ¿Qué exige la Ley 1/2016 sobre protección de datos y sobre alojar datos fuera de la CEMAC? Según fuentes secundarias, su órgano de control no está operativo.
12. ¿Qué plazos y obligaciones aplican según OHADA a la contabilidad, el comisario de cuentas y la conservación de libros?
13. ¿Qué textos públicos de FondosEG deben cambiar de inmediato (art. 80)? "Cumplimiento CEMAC" ya se retiró.
## 10. Datos pendientes del responsable del proyecto

- [x] ¿FondosEG maneja ya dinero real de clientes? **No**, según indicó el responsable el 2 de noviembre de 2026.
- [ ] ¿Existe ya la empresa operadora? ¿Con qué forma jurídica y registro?
- [ ] ¿Hay contratos, licencias o conversaciones con entidades autorizadas que no consten en el repositorio?

## 11. Fuentes

**CEMAC**

- [Acerca de la CEMAC](https://cemac.int/about/)
- [Reglamentos y directivas de la CEMAC](https://cemac.int/reglements-directives/)

**BEAC y COBAC**

- [Reglamento 04/18/CEMAC/UMAC/COBAC](https://www.beac.int/wp-content/uploads/2019/07/REGLEMENT-N-04-18-CEMAC-UMAC-COBAC-du-21-d%C3%A9cembre-2018.pdf)
- [Normativa de sistemas de pago de la BEAC](https://www.beac.int/systemes-paiement/instructions-circulaires-reglements/)
- [Presentación de los sistemas de pago](https://www.beac.int/systemes-paiement/presentation-generale/)
- [Instrucción 001/GR/2018](https://www.beac.int/wp-content/uploads/2016/10/Instruction_du_GR_001_GR_2018-1.pdf)
- [Instrucción 001/GR/2025 sobre ISO 20022](https://www.beac.int/wp-content/uploads/2016/10/Instruction-N°001-GR-2025_norme-ISO-20022.pdf)
- [Informe de servicios de pago 2023](https://www.beac.int/wp-content/uploads/2016/10/RAPPORT-SUR-LES-SERVICES-DE-PAIEMENT-DANS-LA-CEMAC2.pdf)

**GIMAC**

- [Web de GIMAC](https://gimac-afr.com/)
- [Adhesión de agregadores](https://gimac-afr.com/wp-content/uploads/2025/12/Fiches_GIMAC_Modalite_adhesion_Agregateurs.pdf)
- [Adhesión de establecimientos de pago y sociedades de transferencia](https://gimac-afr.com/wp-content/uploads/2025/12/ep_sta.pdf)

**OHADA**

- [Estados miembros](https://www.ohada.org/les-etats-membres-de-lohada/)
- [Derecho comercial general](https://www.ohada.org/droit-commercial-general/)
- [Derecho contable](https://www.ohada.org/acte-uniforme-relatif-au-droit-comptable-et-a-linformation-financiere-audcif/)

**Fuentes secundarias**

- [Marco de fintech en la CEMAC](https://droitmediasfinance.com/index.php/actualites/droit-tech-fintech/987-tribune-fintech-le-cadre-reglementaire-des-fintechs-finance-numerique-en-zone-cemac-me-landry-mballa)
- [Reglamento COBAC R-2023/01](https://droitmediasfinance.com/index.php/actualites/droit-bancaire/739-cobac-le-reglement-cobac-r-2023-01-relatif-aux-nouvelles-diligences-des-etablissements-assujettis-en-matiere-de-lutte-contre-le-blanchiment-de-capitaux-entrera-en-vigueur-le-1er-juillet-2024)
- [Reglamentos antiblanqueo de 2024](https://droitmediasfinance.com/index.php/actualites/lutte-anti-blanchiment/948-aml-blanchiment-des-capitaux-cemac-trois-nouveaux-reglements-adoptes-en-decembre-2024-sur-la-prevention-repression-et-sanctions-financieres-ciblees)
- [Resumen de R-2024/01 (Just IT)](https://justit.cm/reglement-cobac-2024/)
- [Ley 1/2016 de Guinea Ecuatorial (DLA Piper)](https://www.dlapiperdataprotection.com/?c=GQ&t=law)
- [Muni Dinero, BGFIMoney y GETESA Money (EcoMatin)](https://ecomatin.net/paiement-mobile-au-bas-du-classement-en-zone-cemac-la-guinee-equatoriale-relance-le-projet-getesa-money)
- [Muni Dinero como billetera de destino (Taptap Send)](https://help.taptapsend.com/en/receiving-countries/how-can-i-send-money-to-equatorial-guinea)
