<script>
  import { selectedTab } from "../utils/stores";
  import { createSheet, updateMetaData, appendData } from "../utils/libs";
  export let files = [];

  export let onClose = () => {};

  let selectedOption = "";
  let options = [
    { name: "Append data" },
    { name: "Open in a new tab" },
    { name: "Replace data" },
  ];

  $:console.log(selectedOption)
  function onCheck(e) {
    if (files) selectedOption = e.target.id;
  }

  function onImport() {
    switch (selectedOption) {
      case "Append data":
        iterate((file) => {
          console.log(file.data)
          appendData($selectedTab.id, file.data)
        });
        break;

      case "Open in a new tab":
        iterate((file) => {
          createSheet({
            data: file.data,
            path: file.path,
            sheetName: file.sheetName,
          });
        });
        break;

      case "Replace data":
        /*Replace data of selected tabs store*/
        let totalData = [];
        iterate((file) => {
          totalData.push(...file.data);
          updateMetaData({ data: totalData, savedChange: false }, $selectedTab.id);
        });
        break;
      default:
        break;
    }
    onClose();
  }
  function iterate(callback = () => {}) {
    for (let i = 0; i < files.length; i++) {
      callback(files[i]);
    }
  }
</script>

<container
  class="position-fixed top-0 d-grid align-items-center justify-content-center bg-light bg-opacity-50"
>
  <div class="shadow rounded-2 p-2 bg-white drag-options">
    <div class="text-uppercase text-center"><b>Import</b></div>
    <hr class="m-1" />
    {#each options as option}
      <div class="form-check">
        <input
          type="radio"
          name="flexRadioDefault"
          id={option.name}
          on:change={onCheck}
        />
        <label class="form-check-label" for={option.name}>
          {option.name}
        </label>
      </div>
    {/each}
    <div class="d-flex align-items-center justify-content-between py-2">
      <button class="btn btn-sm btn-secondary" on:click={onClose}>Cancel</button
      >
      <button class="btn btn-sm btn-info" on:click={onImport} disabled={selectedOption ? false : true}>Import</button>
    </div>
  </div>
</container>

<style>
  container {
    width: 100vw;
    height: 100vh;
    z-index: 2;
  }
  .drag-options {
    min-width: 250px;
  }
</style>
