<script>
  import { getContext } from "svelte";
  import { TABS } from "./Tabs.svelte";

  const panel = {};
  const { registerPanel, selectedPanel } = getContext(TABS);

  registerPanel(panel);
</script>

<div class="position-relative">
  <div class={`position-absolute top-0 ${$selectedPanel === panel ? "visible-sheet" : "invisible-sheet"}`}>
    <slot></slot>
  </div>
</div>

<style>
  .visible-sheet {
    z-index: 1;
    opacity: 1;
  }
  .invisible-sheet {
    z-index: -1;
    opacity: 0;
  }
</style>