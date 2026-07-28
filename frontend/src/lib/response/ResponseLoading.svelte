<script lang="ts">
  // Rotating primrose + live elapsed time while a request is in flight.
  import { onDestroy } from 'svelte';
  import primroseLogo from '../../assets/images/primrose-logo.svg';
  import { fmtElapsed } from './format';

  // ~50ms keeps the display fluid without excessive redraws
  const TIMER_TICK_MS = 53;
  const startedAt = Date.now();
  let elapsedMs = 0;
  const timer = setInterval(() => (elapsedMs = Date.now() - startedAt), TIMER_TICK_MS);
  onDestroy(() => clearInterval(timer));
</script>

<div class="loading">
  <img class="spinner" src={primroseLogo} alt="loading" />
  <span class="elapsed">{fmtElapsed(elapsedMs)}</span>
</div>

<style>
  .loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .spinner {
    width: 56px;
    height: 56px;
    animation: primrose-spin 1.6s linear infinite;
  }
  .elapsed {
    font-size: 13px;
    color: #999;
    font-variant-numeric: tabular-nums;
  }
  @keyframes primrose-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
