<script>
  import { getContext } from "svelte";
  import { TABS } from "./Tabs.svelte";

  export let id="";
  export let onclose = () => {};
  const tab = { id };

  const { registerTab, selectTab, selectedTab } = getContext(TABS);

  registerTab(tab);
</script>

<div
  class={`${
    $selectedTab === tab ? "selected" : ""
  } tab-label d-flex justify-content-between py-1`}
>
  <button class="label" on:click={() => selectTab(tab)}>
    <slot />
  </button>
  <button class="text-secondary" on:click={onclose}>X</button>
</div>

<style>
  .tab-label {
    width: 130px;
  }
  button.label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    width: 100px;
  }
  button {
    background: none;
    border: none;
    border-radius: 0;
    margin: 0;
    text-align: left;
  }

  .selected {
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;
    background-color: rgba(77, 77, 77, 0.212);
  }
</style>
