<script>
  import { updateMetaData } from "../utils/libs";

  export let data = [[]];
  export let sheetName = "";
  export let path = "";
  export let id;
  export let savedChange = false;

  const thead = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let highlightedValue = "";

  $: showCellPosition = (row_num, col_num) => {
    highlightedValue = `${row_num} : ${thead[col_num]}`;
  };
  $: removeCellPosition = () => {
    highlightedValue = "";
  };

  function changeName(e) {
    e.preventDefault();

    if (!path) {
      updateMetaData({ sheetName }, id);
      return;
    }
    window.electron.rename(
      { id, filePath: path, newName: sheetName },
      (response) => {
        updateMetaData({ sheetName, ...response }, id);
      }
    );
  }

  function editValue(e, row_num = 0, col_num = 0) {
    if (!data[+row_num]) {
      data[+row_num] = [];
    }

    data[+row_num][+col_num] = e.target.value.trim();

    console.log(data);
    if (savedChange) {
      updateMetaData({ savedChange: false, data }, id);
    } else {
      updateMetaData({ data }, id);
    }
  }

  function getCellValue(row_num, col_num) {
    if (!data[+row_num]) {
      return "";
    }
    if (data[+row_num][col_num]) return data[+row_num][col_num];
    else return "";
  }

  $:console.log(data)
</script>

<section {id}>
  <div class="pt-2">
    <form class="py-1 my-1" on:submit={changeName}>
      <input type="text" bind:value={sheetName} class="sheet-name" />
      <button type="submit" class="btn btn-sm btn-info"> Change </button>
    </form>
  </div>

  <table data-key={id}>
    <thead class="bg-white">
      <tr>
        {#each thead as letter, i}
          {#if i === 0}
            <th
              class={`p-1 bg-info text-center cell-num position-of-cell position-sticky top-0`}
            >
            <div class="resize-both">
              <small> {highlightedValue} </small>
            </div>
            </th>
          {:else}
            <th
              class={`p-1 bg-info text-center position-sticky top-0 ${
                letter.trim() ? "cell-size" : "cell-num"
              }`}
              tabindex={1}
              data-column-letter={letter}
              data-column={i}
            >
            <div class="resize-x td-label">
              {letter}
              </div>
            </th>
          {/if}
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each data.length >= 100 ? data : new Array(100) as row, row_num (row_num)}
        <tr data-row={row_num}>
          {#each new Array(27) as col, col_num (col_num)}
            {#if col_num === 0}
              <td
                class="pt-0 px-1 cell-num text-center bg-light"
                data-row={row_num + 1}
                data-column={col_num}>
                <div class="resize-y overflow-hidden">
                  <small>{row_num + 1}</small>
                </div></td
              >
            {:else}
              <td
                class="p-0 cell-size hover-cell"
                data-row={row_num + 1}
                data-column={col_num}
              >
                  <div
                    class="border-0 input-cell"
                    contenteditable="{true}"
                    tabindex={1}
                    role="textbox"
                    on:change={(e) => editValue(e, row_num, col_num - 1)}
                    on:focus={() => showCellPosition(row_num + 1, col_num)}
                    on:blur={removeCellPosition}
                    >{getCellValue(row_num, col_num - 1)}</div
                  >
              </td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  table {
    overflow: auto;
    display: block;
    height: calc(100vh - 150px);
    width: 100vw;
  }
  table,
  thead,
  thead > tr {
    position: relative;
  }
  .position-of-cell {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .position-of-cell div {min-height: 30px; overflow: hidden;height: 100%;display: inline-flex;justify-content: center;align-items: center;}
  .sheet-name {
    border: 0;
    width: auto;
    text-overflow: ellipsis;
  }
  .sheet-name:focus {
    outline: 2px solid var(--bs-cyan);
  }
  .td-label {
    overflow: hidden;min-height: 30px;min-width: 100px;
  }
</style>
