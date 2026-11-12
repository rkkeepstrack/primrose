<script lang="ts">
  const groups = [
    {
      title: 'Request',
      items: [
        { keys: ['⌘', 'S'], what: 'Save the open request' },
        { keys: ['⌘', '↵'], what: 'Send the open request' },
        { keys: ['⌘', 'Z'], what: 'Undo the last edit (⌘⇧Z redoes); text editors undo per keystroke, everything else per request' },
        { keys: ['⌘', '1–4'], what: 'Switch request tab (Query / Body / Headers / Variables)' },
        { keys: ['Esc'], what: 'Close the open request (unsaved edits are kept)' },
      ],
    },
    {
      title: 'Response',
      items: [{ keys: ['⌘', '5–7'], what: 'Switch response tab (Response / Headers / Timeline)' }],
    },
    {
      title: 'Navigation',
      items: [
        { keys: ['⌘', 'P'], what: 'Quick open search — Enter opens the first match, Esc clears' },
        { keys: ['⌥', '↑ / ↓'], what: 'Hop to the previous / next request' },
        { keys: ['←', '→'], what: 'Resize the split (when the divider is focused)' },
      ],
    },
    {
      title: 'General',
      items: [
        { keys: ['⌘', 'N'], what: 'New request in the active collection' },
        { keys: ['⌘', 'O'], what: 'Open a collection folder' },
        { keys: ['⌘', 'W'], what: 'Close the active tab' },
        { keys: ['⌘', 'K'], what: 'Show / hide this shortcut reference' },
        { keys: ['↵ / Esc'], what: 'Confirm / dismiss dialogs' },
      ],
    },
  ];
</script>

<div class="shortcuts">
  {#each groups as group (group.title)}
    <section>
      <h3>{group.title}</h3>
      <ul>
        {#each group.items as item}
          <li>
            <span class="keys">
              {#each item.keys as key, i}
                {#if i > 0}<span class="plus">+</span>{/if}
                <kbd>{key}</kbd>
              {/each}
            </span>
            <span class="what">{item.what}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .shortcuts {
    padding: 24px 28px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 640px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--green-text);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 14px;
    font-size: 13px;
  }
  .keys {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: 110px;
  }
  .plus {
    color: var(--text-disabled);
    font-size: 11px;
  }
  kbd {
    font-family: inherit;
    font-size: 12px;
    color: var(--text-soft);
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 5px;
    padding: 2px 7px;
  }
  .what {
    color: var(--text-muted);
  }
</style>
