<script>
  import Sheet from "./components/Sheet.svelte";
  import MainPage from "./components/MainPage.svelte";
  import url from "./utils/svelte-hash-route";
  import { sheets } from "./utils/stores";
  import { Tabs, Tab, TabPanel, TabList } from "./components/MultiTab/tabs";
  import DragOptions from "./components/DragOptions.svelte";
  import { MenuBar, MenuItem } from "./components/Menu/menu";
  import {
    removeTab,
    createSheet,
    updateMetaData,
    getSheetById,
  } from "./utils/libs";
  import { Files, selectedTab, Data } from "./utils/stores";

  let showDragOps = false;
  let draggedFilesData = [/*{ id: "", data: "", path: "", sheetName: "" }*/];

  $: SHEETS = JSON.parse($sheets);
  $: !SHEETS.length ? (location.href = "#/") : null;

  $: () => {
    Files.update((v) => {
      v.map((submenu) => {
        switch (submenu.name) {
          case "Save":
            submenu.click = () => saveFile();
          case "Save As":
            submenu.click = () => saveFile();
          default:
            break;
        }
      });
    });
  };

  window.addEventListener("keypress", (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === "s") saveFile();
    else if (e.ctrlKey && e.shiftKey && e.key === "S") saveFile(true);
    /* Not tested */ else if (e.ctrlKey && !e.shiftKey && e.key === "n")
      createSheet();
    else if (e.ctrlKey && !e.shiftKey && e.key === "o") openFile();
  });

  $: saveFile = (saveAs = false) => {
    document.activeElement.blur();
    window.electron.save(
      getSheetById($selectedTab.id),
      (res) => {
        console.log(res);
        updateMetaData({ ...res, savedChange: true }, res.id);
      },
      saveAs
    );
  };

  const openFile = () => {
    const input = document.getElementById("open-file-input"); //files: e.target.files
    input.setAttribute("value", "");
    input.click();
  };

  function onOpenFile(e) {
    console.log(e.target.files);
    if (e.target.files.length) {
      window.electron.open([...e.target.files], (response) => {
        if (response) createSheet(response);
      });
    }
  }
  function stopDefault(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log(e.dataTransfer.files);

    if (!$selectedTab) {
      window.electron.open([...e.dataTransfer.files], (response) => {
        createSheet(response);
        console.log(response);
      });
    } else {
      showDragOps = true;
      window.electron.open([...e.dataTransfer.files], (response) => {
          draggedFilesData.push(response);
      });
    }
  }
</script>

<svelte:body on:drop={onDrop} on:dragover={stopDefault} />
<MenuBar>
  <MenuItem SubMenuItems={$Files}>File</MenuItem>
  <MenuItem SubMenuItems={$Data}>Data</MenuItem>
</MenuBar>

<main class="pt-1">
  <input
    id="open-file-input"
    type="file"
    accept=".csv"
    on:change={onOpenFile}
  />
  {#if $url.hash === "" || $url.hash === "#/"}
    <MainPage />
  {:else if $url.hash.includes("#/sheet")}
    <Tabs>
      <TabList>
        {#each SHEETS as sheet (sheet.id)}
          <Tab onclose={() => removeTab(sheet.id)} id={sheet.id}>
            <small class={`position-relative ${sheet.savedChange == true ? "" : "not-saved"}`}> {sheet.sheetName} </small>
          </Tab>
        {/each}
      </TabList>

      {#each SHEETS as sheet (sheet.id)}
        <TabPanel>
          <Sheet
            data={sheet.data}
            sheetName={sheet.sheetName}
            id={sheet.id}
            path={sheet.path}
            savedChange={sheet.savedChange}
          />
        </TabPanel>
      {/each}
    </Tabs>
  {/if}
</main>
{#if showDragOps}
  <DragOptions
    files={draggedFilesData}
    onClose={() => (showDragOps = false)}
  />
{/if}

<style>
  #open-file-input {
    display: none;
  }
</style>
