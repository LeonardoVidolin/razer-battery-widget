# Changelog

## [1.1.0] — 2026-04-09

### Adicionado

- Controles de **volume de saída (fone)** e **microfone** no Windows (PowerShell + Core Audio), com arraste e teclado.
- Opção **Always on top** na bandeja, com níveis de Z-order no Windows e reaplicação periódica.
- Poll de bateria no processo principal + envio centralizado ao renderer para atualização mais confiável.

### Corrigido / melhorado

- **Synapse 4:** leitura de `level` numérico ou string; descoberta de log `systray_systrayv*.log` alinhada; mantém última bateria válida quando o campo some no JSON.
- **Synapse 3:** segundo padrão de regex para `_OnBatteryLevelChanged` (ex.: headset wireless); reduz **0%** espúrio quando o último evento no log contradiz o anterior.
- **UI:** ao haver entradas duplicadas do mesmo modelo, prioriza a leitura de bateria mais plausível (nome / tipo).

### Build

- Instalador NSIS: `npm run dist` → `dist/Razer Battery Widget Setup 1.1.0.exe`.

## [1.0.0] — anterior

- Versão inicial publicada no repositório.
