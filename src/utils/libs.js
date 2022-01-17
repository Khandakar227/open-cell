import { get } from "svelte/store";
import { sheets } from './stores';

export const checkExtension = (filename = "", extensions = []) => {
  const parts = filename.split('.');
  return extensions.includes(parts[parts.length - 1])
}

export const createSheet = (
  sheet = {
    id: Date.now(), data: [[]], sheetName: `NewSheet_${Date.now()}`, path: "", savedChange: false,
  }) => {
  if (get(sheets) === "[]") {
    sheets.set(JSON.stringify([sheet]));
  }
  else {
    sheets.update(v => {
      let initVal = JSON.parse(v);
      initVal.push(sheet);
      return JSON.stringify(initVal)
    })
  }
  location.href = `#/sheet`;
};

export const getParams = () => {
  return location.hash.substring(8).split("&").reduce((res, item) => {
    let parts = item.split("=");
    res[parts[0]] = parts[1];
    return res
  }, {})
}

export const removeTab = (id) => {
  sheets.update(v => {
    let initVal = JSON.parse(v);
    return JSON.stringify(initVal.filter((value) => value.id !== id));
  })
  console.log(get(sheets))
}

export const updateMetaData = (props, id) => {
  sheets.update(v => {
    let initVal = JSON.parse(v);
    for (let x = 0; x < initVal.length; x++) {
      if (initVal[x].id === id) {
        initVal[x] = { ...initVal[x], ...props }
      }
    }
    return JSON.stringify(initVal)
  })
}
export const getSheetById = (id) => {
  const parsedSheet = JSON.parse(get(sheets))
  return parsedSheet.find((v, i) => v.id === id)
}

export const appendData = (id, data) => {
  sheets.update(v => {
    let initVal = JSON.parse(v);
    for (let x = 0; x < initVal.length; x++) {
      if (initVal[x].id === id) {
        initVal[x].data.push(...data);
        initVal[x].savedChange = false;
      }
    }
    return JSON.stringify(initVal)
  })
}