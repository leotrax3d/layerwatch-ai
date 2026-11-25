<!--
  A dashboard card of one printer's failure check: the verdict, the trend
  above the print's own baseline, the newest picture with what the detector
  flagged, and the latest incident. It reads the status this host's screens
  share, which follows the core's event stream, and polls nothing.
-->
<script lang="ts">
  import { describeFault } from '@prusa/connect-ui/i18n';
  import {
    Badge,
    FaultAlert,
    Skeleton,
    TilePanel,
  } from '@prusa/connect-ui/primitives';
  import { moduleIcon, type CardProps } from '@prusa/connect-ui/slots';
  import { onDestroy } from 'svelte';

  import { guardOn } from '../guard';
  import { heldHost } from '../host';
  import { liveFor } from '../live.svelte';
  import Framed from '../framed.svelte';
  import Meter from '../meter.svelte';
  import { verdictBadge, when } from '../verdict';

  let { config, title, size, editing }: CardProps = $props();

  const host = heldHost();
  const t = host.t;
  const live = liveFor(host);
  const guard = guardOn(host);
  const PageIcon = moduleIcon('printer');

  // The printer the person picked, else the first one the guard follows, so a
  // card placed before anything is set already shows something.
  const picked = $derived(
    typeof config.device === 'string' ? config.device : '',
  );
  const watch = $derived.by(() => {
    if (picked !== '') return live.watchOf(picked);
    return live.state.kind === 'ready'
      ? live.state.status.cameras[0]
      : undefined;
  });
  const printer = $derived(picked !== '' ? picked : (watch?.printer ?? ''));
  const incident = $derived(
    printer !== '' ? live.incidentOf(printer) : undefined,
  );
  const printerName = $derived(
    printer === '' ? '' : (host.fleet.device(printer)?.name ?? printer),
  );

  // What a small card leaves out: the picture first, then the figures.
  const roomy = $derived(size.h >= 5);
  const showPicture = $derived(config.picture !== false && roomy);
  const showFigures = $derived(size.h >= 3);

  let picture = $state<string | undefined>();

  // A new picture for every frame the guard judged, read only while the card
  // draws one. The old picture stays until the next one is in, so the card
  // never blinks empty, and it is let go when it is replaced or the card goes.
  $effect(() => {
    // Reading `last` is what makes a newly judged frame fetch a new picture.
    const camera = watch?.camera;
    if (!showPicture || camera === undefined || watch?.last === undefined)
      return;

    let stale = false;
    guard
      .snapshot(camera, host.signal)
      .then((url) => {
        if (stale) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        const old = picture;
        picture = url;
        if (old && old !== url) URL.revokeObjectURL(old);
      })
      .catch(() => undefined);

    return () => {
      stale = true;
    };
  });

  onDestroy(() => {
    if (picture) URL.revokeObjectURL(picture);
  });
</script>

<TilePanel
  {title}
  fallback={printerName === ''
    ? t('guard.page.title')
    : t('guard.card.heading', { printer: printerName })}
  subline={live.state.kind === 'ready'
    ? t(`guard.detector.${live.state.status.detector}`)
    : undefined}
>
  {#snippet trailing()}
    {#if watch}
      {#if watch.printing}
        <Badge variant={verdictBadge[watch.verdict]}
          >{t(`guard.verdict.${watch.verdict}`)}</Badge
        >
      {:else}
        <Badge variant="outline">{t('guard.camera.idle')}</Badge>
      {/if}
    {/if}
    {#if !editing}
      <a
        href={host.pageHref('layerwatch-ai')}
        class="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={t('guard.card.open')}
      >
        <PageIcon aria-hidden="true" class="size-4" />
      </a>
    {/if}
  {/snippet}

  {#if live.state.kind === 'loading'}
    <Skeleton class="h-16" role="status" aria-label={t('guard.card.loading')} />
  {:else if live.state.kind === 'error'}
    <FaultAlert fault={describeFault(live.state.thrown)} />
  {:else if watch === undefined}
    <p class="text-sm text-muted-foreground">
      {printer === ''
        ? t('guard.cameras.empty.body')
        : t('guard.card.notFollowed')}
    </p>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col gap-2">
      {#if showPicture}
        {#if picture}
          <Framed
            class="min-h-0 w-full flex-1"
            src={picture}
            alt={watch.camera}
            boxes={watch.boxes}
          />
        {:else}
          <div
            class="flex min-h-0 w-full flex-1 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground"
          >
            {t('guard.camera.noPicture')}
          </div>
        {/if}
      {/if}

      <Meter {watch} />

      {#if showFigures}
        <dl class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          <dt class="text-muted-foreground">{t('guard.camera.score')}</dt>
          <dd class="tabular-nums">{watch.score.toFixed(2)}</dd>
          <dt class="text-muted-foreground">{t('guard.camera.excess')}</dt>
          <dd class="tabular-nums">{watch.excess.toFixed(2)}</dd>
          {#if roomy}
            <dt class="text-muted-foreground">{t('guard.camera.frames')}</dt>
            <dd class="tabular-nums">{watch.frames}</dd>
            <dt class="text-muted-foreground">{t('guard.camera.last')}</dt>
            <dd class="truncate">{when(watch.last)}</dd>
          {/if}
        </dl>
      {/if}

      {#if watch.error}
        <p class="truncate text-sm text-destructive">{watch.error}</p>
      {/if}
      {#if incident && roomy}
        <p class="truncate text-xs text-muted-foreground">
          {t('guard.card.incident', {
            time: when(incident.time),
            outcome: incident.outcome,
          })}
        </p>
      {/if}
    </div>
  {/if}
</TilePanel>
