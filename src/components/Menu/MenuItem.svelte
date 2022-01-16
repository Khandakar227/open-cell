<script>
  const platform = navigator?.userAgentData?.platform || navigator?.platform || "unknown";

  export let SubMenuItems = [
    { name: "New", accelerator: "Ctrl + N", click: ()=>{} },
    { name: "Open", accelerator: "Ctrl + O", click: ()=>{} },
    { name: "Save", accelerator: "Ctrl + S", click: ()=>{} },
    { name: "Save As", accelerator: "Ctrl + Shift + S", click: ()=>{} },
  ];
  function keyShrtcut(accelerator) {
    if (platform === "darwin") return accelerator.replace("Ctrl", "Cmd");
    else return accelerator;
  }
</script>

<div class="menuItem position-relative">
  <button class="bg-transparent menu-btn"><slot></slot></button>
  <div class="p-1 bg-light shadow position-absolute submenu-Items">
    {#each SubMenuItems as submenu}
      <button class="bg-transparent btn-sm btn" on:click="{submenu.click}">
        {submenu.name}
        <span class=" text-black-50">
          {keyShrtcut(submenu.accelerator)}
        </span></button
      >
    {/each}
  </div>
</div>

<style>
    .menu-btn {
        border: none;
        padding: 1px;
        font-size: 14px;
    }
  .submenu-Items {
    display: none;
    z-index: 10;
  }
  .submenu-Items > button {
    width: 200px;
    text-align: left;
    display: flex;
    justify-content: space-between;
  }
  .submenu-Items > button:hover {
    background-color: #e2e2e2 !important;
  }
  .menuItem:focus-within .submenu-Items {
    display: block;
  }
</style>
