## Resumo

Entrega da **v1.1.0** do **Razer Battery Widget** (Windows): bateria mais estável com Razer Synapse 3 e 4, janela sempre visível e níveis de áudio do sistema.

## O que mudou

### Novidades

- **Áudio Windows:** sliders de saída (fone) e microfone integrados ao widget, usando Core Audio via PowerShell.
- **Always on top:** opção na bandeja; no Windows usa níveis de topo (`screen-saver` → `pop-up-menu` → `floating`) com reaplicação ao mostrar e poll leve.
- **Bateria:** timer no `main` com `refresh()` periódico + `pushDevicesToRenderer()`; fallback no renderer com `getDevices()`; envio após `did-finish-load`.

### Correções

- **Synapse 4:** `powerStatus.level` como string não zera mais a %; regex de ficheiros de log igual à descoberta de candidatos; mescla por nome evita linha duplicada com 0%.
- **Synapse 3:** regex alternativo para `_OnBatteryLevelChanged` e heurística quando o último evento é 0% logo após leitura válida (comum em headsets wireless).

### Notas

- Versão no `package.json`: **1.1.0**.
- Artefato de release: `npm run dist` → `dist/Razer Battery Widget Setup 1.1.0.exe`.
