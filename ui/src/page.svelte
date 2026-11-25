<script lang="ts">
  import { describeFault, type FaultText } from '@prusa/connect-ui/i18n';
  import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    FaultAlert,
    PageHeader,
    Skeleton,
  } from '@prusa/connect-ui/primitives';

  import {
    guardOn,
    type Check,
    type Incident,
    type Status,
    type Test,
    type Watch,
  } from './guard';
  import { heldHost } from './host';
  import Framed from './framed.svelte';
  import Meter from './meter.svelte';
  import Setup from './setup.svelte';
  import { verdictBadge, when } from './verdict';

  const host = heldHost();
  const t = host.t;
  const guard = guardOn(host);

  // How often the page reads the status again. The module judges a frame on
  // the camera's own cadence, so a faster refresh shows nothing new.
  const REFRESH_MS = 10_000;

  let status = $state<Status | undefined>();
  let incidents = $state<Incident[]>([]);
  let fault = $state<FaultText | undefined>();
  let pictures = $state<Record<string, string | undefined>>({});
  let frames = $state<Record<string, string | undefined>>({});
  let resetting = $state<string | undefined>();
  let resetDone = $state<string | undefined>();
  let checking = $state(false);
  let checked = $state<Check | undefined>();
  let testing = $state<string | undefined>();
  let tests = $state<Record<string, Test | undefined>>({});
  let testFaults = $state<Record<string, FaultText | undefined>>({});

  const check = async () => {
    checking = true;
    try {
      checked = await guard.check(host.signal);
    } catch (thrown: unknown) {
      if (!host.signal.aborted) fault = describeFault(thrown);
    } finally {
      checking = false;
    }
  };

  const test = async (watch: Watch) => {
    testing = watch.printer;
    testFaults[watch.printer] = undefined;
    try {
      tests[watch.printer] = await guard.test(watch.printer, host.signal);
    } catch (thrown: unknown) {
      if (!host.signal.aborted)
        testFaults[watch.printer] = describeFault(thrown);
    } finally {
      testing = undefined;
    }
  };

  const printerName = (id: string): string => host.fleet.device(id)?.name ?? id;

  /** Replaces one object URL with another and frees the old one. */
  const swap = (
    held: Record<string, string | undefined>,
    key: string,
    next: string | undefined,
  ) => {
    const old = held[key];
    if (old && old !== next) URL.revokeObjectURL(old);
    held[key] = next;
  };

  const refresh = async () => {
    try {
      const [nextStatus, nextIncidents] = await Promise.all([
        guard.status(host.signal),
        guard.incidents(host.signal),
      ]);
      status = nextStatus;
      incidents = nextIncidents;
      fault = undefined;

      for (const watch of nextStatus.cameras) {
        guard
          .snapshot(watch.camera, host.signal)
          .then((url) => swap(pictures, watch.camera, url))
          .catch(() => swap(pictures, watch.camera, undefined));
      }

      for (const incident of nextIncidents.slice(0, 6)) {
        if (incident.id in frames) continue;
        frames[incident.id] = undefined;
        guard
          .frame(incident, host.signal)
          .then((url) => swap(frames, incident.id, url))
          .catch(() => undefined);
      }
    } catch (thrown: unknown) {
      if (!host.signal.aborted) fault = describeFault(thrown);
    }
  };

  const reset = async (watch: Watch) => {
    resetting = watch.printer;
    try {
      await guard.reset(watch.printer, host.signal);
      resetDone = watch.printer;
      await refresh();
    } catch (thrown: unknown) {
      if (!host.signal.aborted) fault = describeFault(thrown);
    } finally {
      resetting = undefined;
    }
  };

  $effect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const stop = () => clearInterval(timer);
    host.signal.addEventListener('abort', stop, { once: true });

    return () => {
      stop();
      for (const url of [
        ...Object.values(pictures),
        ...Object.values(frames),
      ]) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  });
</script>

<div class="flex flex-col gap-4">
  <PageHeader title={t('guard.page.title')} />

  {#if fault}
    <FaultAlert {fault} />
  {/if}

  {#if !status}
    <Skeleton class="h-40 w-full" />
  {:else}
    <p class="text-sm text-muted-foreground">
      {t('guard.page.summary', {
        detector: t(`guard.detector.${status.detector}`),
        action: t(`guard.action.${status.action}`),
      })}
    </p>

    <Setup onsaved={() => void refresh()} />

    {#if status.action === 'notify'}
      <p class="rounded-md bg-muted p-3 text-sm">{t('guard.trial.note')}</p>
    {/if}

    <Card>
      <CardHeader>
        <CardTitle>{t('guard.health.title')}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted-foreground">{t('guard.health.analyses')}</dt>
          <dd class="tabular-nums">
            {status.health.analyses} · {t('guard.health.failures', {
              count: status.health.failures,
            })}
          </dd>
          <dt class="text-muted-foreground">{t('guard.health.lastOk')}</dt>
          <dd>{when(status.health.last_ok)}</dd>
          <dt class="text-muted-foreground">{t('guard.health.millis')}</dt>
          <dd class="tabular-nums">{status.health.last_millis} ms</dd>
        </dl>
        {#if status.health.last_error}
          <p class="text-sm text-destructive">
            {t('guard.health.lastError')}: {status.health.last_error}
          </p>
        {/if}
        <div class="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={checking}
            onclick={() => void check()}
          >
            {t('guard.health.check')}
          </Button>
          {#if checked}
            {#if checked.reachable}
              <Badge variant="success"
                >{t('guard.health.reachable', {
                  millis: checked.millis,
                })}</Badge
              >
            {:else}
              <Badge variant="destructive"
                >{t('guard.health.unreachable')}</Badge
              >
              <span class="text-sm text-destructive">{checked.problem}</span>
            {/if}
          {/if}
        </div>
      </CardContent>
    </Card>

    <h2 class="text-lg font-semibold">{t('guard.cameras.title')}</h2>

    {#if status.cameras.length === 0}
      <EmptyState
        headingLevel="h3"
        heading={t('guard.cameras.empty.title')}
        description={t('guard.cameras.empty.body')}
      />
    {:else}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {#each status.cameras as watch (watch.camera)}
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center justify-between gap-2">
                <span class="truncate">{printerName(watch.printer)}</span>
                {#if watch.printing}
                  <Badge variant={verdictBadge[watch.verdict]}
                    >{t(`guard.verdict.${watch.verdict}`)}</Badge
                  >
                {:else}
                  <Badge variant="outline">{t('guard.camera.idle')}</Badge>
                {/if}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-3">
              {#if pictures[watch.camera]}
                <Framed
                  class="aspect-video w-full"
                  src={pictures[watch.camera] ?? ''}
                  alt={watch.camera}
                  boxes={tests[watch.printer]?.boxes ?? watch.boxes}
                />
              {:else}
                <div
                  class="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground"
                >
                  {t('guard.camera.noPicture')}
                </div>
              {/if}

              <Meter {watch} />

              <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt class="text-muted-foreground">{t('guard.camera.score')}</dt>
                <dd class="tabular-nums">{watch.score.toFixed(2)}</dd>
                <dt class="text-muted-foreground">
                  {t('guard.camera.excess')}
                </dt>
                <dd class="tabular-nums">{watch.excess.toFixed(2)}</dd>
                <dt class="text-muted-foreground">
                  {t('guard.camera.frames')}
                </dt>
                <dd class="tabular-nums">{watch.frames}</dd>
                <dt class="text-muted-foreground">{t('guard.camera.last')}</dt>
                <dd>{when(watch.last)}</dd>
              </dl>

              {#if watch.error}
                <p class="text-sm text-destructive">{watch.error}</p>
              {/if}
              {#if watch.acted}
                <p class="text-sm font-medium">{t('guard.camera.acted')}</p>
              {/if}
              {#if resetDone === watch.printer}
                <p class="text-sm text-muted-foreground">
                  {t('guard.camera.reset.done')}
                </p>
              {/if}

              {#if tests[watch.printer]}
                <p class="text-sm">
                  {t('guard.test.result', {
                    score: tests[watch.printer]?.score.toFixed(2) ?? '',
                    count: tests[watch.printer]?.boxes.length ?? 0,
                    millis: tests[watch.printer]?.millis ?? 0,
                  })}
                </p>
              {/if}
              {#if testFaults[watch.printer]}
                <FaultAlert fault={testFaults[watch.printer]} />
              {/if}
              <Button
                variant="secondary"
                disabled={testing === watch.printer}
                onclick={() => void test(watch)}
              >
                {t('guard.test.run')}
              </Button>

              {#if watch.printing && watch.verdict !== 'ok' && watch.verdict !== 'warming_up'}
                <Button
                  variant="secondary"
                  disabled={resetting === watch.printer}
                  onclick={() => void reset(watch)}
                >
                  {t('guard.camera.reset')}
                </Button>
              {/if}
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}

    <h2 class="text-lg font-semibold">{t('guard.incidents.title')}</h2>

    {#if incidents.length === 0}
      <p class="text-sm text-muted-foreground">{t('guard.incidents.empty')}</p>
    {:else}
      <div class="flex flex-col gap-3">
        {#each incidents as incident (incident.id)}
          <Card>
            <CardContent class="flex flex-col gap-3 sm:flex-row">
              {#if frames[incident.id]}
                <Framed
                  class="aspect-video w-full sm:w-64"
                  src={frames[incident.id] ?? ''}
                  alt={incident.camera}
                  boxes={incident.boxes}
                />
              {/if}
              <dl
                class="grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-1 text-sm"
              >
                <dt class="text-muted-foreground">
                  {t('guard.camera.printer')}
                </dt>
                <dd>{printerName(incident.printer)}</dd>
                <dt class="text-muted-foreground">{t('guard.camera.last')}</dt>
                <dd>{when(incident.time)}</dd>
                <dt class="text-muted-foreground">
                  {t('guard.incident.outcome')}
                </dt>
                <dd>{incident.outcome}</dd>
                <dt class="text-muted-foreground">
                  {t('guard.incident.score')}
                </dt>
                <dd class="tabular-nums">{incident.score.toFixed(2)}</dd>
                <dt class="text-muted-foreground">
                  {t('guard.incident.detector')}
                </dt>
                <dd>
                  {t(`guard.detector.${incident.detector}`)}
                  {#if incident.boxes?.length}
                    · {t('guard.incident.boxes', {
                      count: incident.boxes.length,
                    })}
                  {/if}
                </dd>
              </dl>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</div>
