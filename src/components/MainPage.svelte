<script>
  import { checkExtension, createSheet } from "../utils/libs";
  let message, type;

  const onInputClick = (e) => {
    e.target.value = null;
  };

  const dropSheet = (e) => {
    if (e.target.files[0]?.name) {
      if (!checkExtension(e.target.files[0]?.name, ["csv"])) {
        message = `${e.target.files[0]?.name} is not a csv file`;
        console.log(message);
        type = "error";
        return;
      }
    }
  };
  const removeMsg = () => {
    message = null;
  };
</script>

<main class="p-2 mx-auto mw-1200">
  <button class="btn btn-info" on:click={createSheet}
    >Create a new spreadsheet</button
  >
  <div class="my-2 text-center">
    <div class="file-drop-area mb-3">
      <svg
        class="mx-auto"
        height="5rem"
        viewBox="0 0 24 24"
        width="5rem"
        fill="lightgrey"
        ><g><rect fill="none" height="24" width="24" /></g><g
          ><path
            d="M18,15v3H6v-3H4v3c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2v-3H18z M17,11l-1.41-1.41L13,12.17V4h-2v8.17L8.41,9.59L7,11l5,5 L17,11z"
          /></g
        ></svg
      >
      <h4 class="mb-3 d-block">Drag and drop any csv file here</h4>
      <input
        class="file-drop-input"
        type="file"
        on:change={dropSheet}
        on:click={onInputClick}
      />
      <button class="btn mb-3 btn-info"> Or choose a file </button>
    </div>

    <div
      class={`${
        message ? "d-grid" : "d-none"
      } text-align-start grid-temp justify-content-between align-items-center alert p-2 ${
        type === "error" ? "alert-danger" : ""
      }`}
    >
      <span> {message} </span>
      <button class="btn" on:click={removeMsg}> X </button>
    </div>
  </div>
</main>
<section class="my-2 p-2">
  <span>Recently opened</span>
</section>

<style>
  .file-drop-area {
    position: relative;
    padding: 2rem 1rem;
    border: 2px dashed #dae1e7;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    background-color: #fff;
    text-align: center;
    cursor: pointer;
  }
  .file-drop-area .file-drop-input {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: transparent;
    opacity: 0;
    outline: none;
    cursor: pointer;
    z-index: 2;
  }
  .grid-temp {
    grid-template-columns: auto 60px;
  }
</style>
