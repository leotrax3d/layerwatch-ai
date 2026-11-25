// The bundle's entry: the LayerWatch AI page in the Connect sidebar, a card
// for dashboards, a section on a printer's Status tab and a line on its card
// in the listing. Every registration is held to `contributes` in module.yaml.
import { defineModule } from '@prusa/connect-ui/slots';

import { holdHost } from './host';
import Page from './page.svelte';
import PrinterCard from './cards/printer-card.svelte';
import DeviceCard from './printer/device-card.svelte';
import DeviceSection from './printer/device-section.svelte';
import './styles.css';

export default defineModule((host) => {
  holdHost(host);
  host.register.page('layerwatch-ai', Page);
  host.register.card('printer', PrinterCard);
  host.register.deviceSection('layerwatch-ai', DeviceSection);
  host.register.deviceCard('layerwatch-ai', DeviceCard);
});
