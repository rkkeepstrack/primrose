<script lang="ts">
  // Colored status label: "200 OK", plain "404", or "Error"/"Canceled".
  import { statusClass } from './format';

  export let status: number | null = null;
  export let text = '';
</script>

<span class="status {status !== null ? statusClass(status) : 'err'}">
  {status !== null ? `${status}${text ? ' ' + text : ''}` : text || 'Error'}
</span>

<style>
  .status {
    font-weight: 600;
  }
  .status.ok {
    color: var(--green);
  }
  .status.err {
    color: var(--red);
  }
  .status.other {
    color: var(--orange);
  }
</style>
