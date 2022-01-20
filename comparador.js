async function getFileContent(file, fileReaderHandler) {
  return new Promise((resolve, reject) => {
    try {
      const fileReader = new FileReader();

      fileReader.addEventListener("load", async () => {
        //Base64URL difers from base64 string from readAsDataURL()
        const fileData = fileReader.result;
        const fileContent = await fileReaderHandler(fileData);
        resolve(fileContent);
      }, false);

      fileReader.readAsArrayBuffer(file);
      // fileReader.readAsBinaryString(file);
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

async function getPdfPageText(pageNum, pdfDocumentInstance) {
  try {
    const pdfPage = await pdfDocumentInstance.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();

    const pageText = textContent.items.map(item => item.str).join('');

    return pageText;
  } catch (error) {
    console.log(error);
  }

  return '';
}

// @data ArrayBuffer
async function readPdfFileContent(data) {
  try {
    // turn array buffer into typed array
    const typedArray = new Uint8Array(data);

    const loadingPdfDocument = pdfjsLib.getDocument(typedArray);
    const pdfDocumentInstance = await loadingPdfDocument.promise;

    const totalNumPages = pdfDocumentInstance.numPages;
    const pagesPromises = [];

    for (let currentPage = 1; currentPage <= totalNumPages; currentPage += 1) {
      pagesPromises.push(getPdfPageText(currentPage, pdfDocumentInstance));
    }

    const pagesData = await Promise.all(pagesPromises);

    const pdfText = pagesData.join(' ');
    return pdfText;
  } catch (error) {
    console.log(error);
  }
}

// @data ArrayBuffer
function readSheetFileContent(data) {
  // const workbook = XLSX.readFile(file);
  // for readAsDataURL
  // const workbook = XLSX.read(data.replace(/_/g, "/").replace(/-/g, "+"), { type:'base64' });
  // type: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
  const workbook = XLSX.read(data, { type: 'buffer' });
  const sheetNameList = workbook.SheetNames;
  const worksheet = workbook.Sheets[sheetNameList[0]];
  const sheetData = XLSX.utils.sheet_to_json(worksheet, {
    header: [
      'CNPJBasico', 'AnoCalendario', 'TipoDeFundo', 'CNPJBenefic', 'CNPJDoador', 'TipoDoacao', 'ValorDoacao'],
    blankrows: false,
  });

  return sheetData;
}

function extractGiversDataFromText(rawText) {
  const regexp = /(CPF\/CNPJ do doador : )(\d{3}.\d{3}.\d{3}-\d{2}|\d{2}.\d{3}.\d{3}\/\d{4}-\d{2})(Valor da doação: R\$ )(-{0,1}[0-9]\d{0,2}((\.\d{3})*),\d{2})/gm;
  const matches = [...rawText.matchAll(regexp)];

  const data = matches.map((match) => ({
    giverDocument: match[2],
    amountDonated: Number(match[4].replace('.', '').replace(',', '.')),
  }));

  return data;
}

document.querySelector("html").classList.add('js');

const outputElement = document.getElementById("output");
const fileInputPdf = document.getElementById("input-file-pdf");
const buttonPdf = document.getElementById("button-input-file-pdf");
const fileReturnPdf = document.getElementById("file-return-pdf");

const fileInputSheet = document.getElementById("input-file-sheet");
const buttonSheet = document.getElementById("button-input-file-sheet");
const fileReturnSheet = document.getElementById("file-return-sheet");

buttonPdf.addEventListener('change', (event) => {
  event.preventDefault();
  fileInputPdf.focus();
});

fileInputPdf.addEventListener("change", function (event) {
  fileReturnPdf.innerHTML = `Arquivo Selecionado: ${event.target.files[0].name}`;
});

buttonSheet.addEventListener('change', (event) => {
  event.preventDefault();
  fileInputSheet.focus();
});

fileInputSheet.addEventListener("change", function (event) {
  fileReturnSheet.innerHTML = `Arquivo Selecionado: ${event.target.files[0].name}`;
});

function isObject(object) {
  return object != null && typeof object === 'object';
}

function deepEqual(object1, object2) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (const key of keys1) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      areObjects && !deepEqual(val1, val2) ||
      !areObjects && val1 !== val2
    ) {
      return false;
    }
  }
  return true;
}

function findDuplicates(array) {
  let results = [];

  for (let i = 0; i < array.length - 1; i += 1) {

    const item1 = array[i + 1];
    const item2 = array[i];

    // if (deepEqual(item1, item2)) {
    if (item1.giverDocument === item2.giverDocument) {
      results.push(array[i]);
    }
  }
  return results;
}

function findDiferences(array1, array2) {
  const diferences = [];

  array1.forEach((item1) => {
    const hasMatching = array2.find((item2) => item2.giverDocument === item1.giverDocument && item2.amountDonated === item1.amountDonated);

    if (!hasMatching) {
      diferences.push(`${item1.giverDocument} - ${item1.amountDonated}`);
    }
  });

  return diferences;
}


async function run() {
  if (!fileInputPdf.files[0] || fileInputPdf.files[0].type !== 'application/pdf') {
    alert('Slecione o arquivo pdf');
    return;
  }

  if (!fileInputSheet.files[0] || fileInputSheet.files[0].type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    alert('Slecione o arquivo da planilha');
    return;
  }

  try {
    const sheetFileContent = await getFileContent(fileInputSheet.files[0], readSheetFileContent);
    const sheetData = sheetFileContent.filter((row, idx) => idx !== 0)
      .map((row) => ({
        giverDocument: row.CNPJDoador.trim(),
        amountDonated: row.ValorDoacao
      }))
      .sort((firstEl, secondEl) => firstEl.giverDocument.localeCompare(secondEl.giverDocument));

    const totalAmountSheet = sheetData.reduce((acc, currentValue) => {
      return acc + currentValue.amountDonated;
    }, 0);
    

    // console.log(sheetData);

    const pdfFileContent = await getFileContent(fileInputPdf.files[0], readPdfFileContent);

    const pdfData = extractGiversDataFromText(pdfFileContent)
      .sort((firstEl, secondEl) => firstEl.giverDocument.localeCompare(secondEl.giverDocument));

    const totalAmountPdf = pdfData.reduce((acc, currentValue) => {
      return acc + currentValue.amountDonated;
    }, 0);

    // const duplicatesPdf = findDuplicates(pdfData).map(item => item.giverDocument);
    // const duplicatesSheet = findDuplicates(sheetData).map(item => item.giverDocument);

    const diferenceSheet = findDiferences(sheetData, pdfData);
    const diferencePdf = findDiferences(pdfData, sheetData);

    const outputData = `<table class="styled-table">
  <tr>
    <th>COMPARAÇÃO</th>
    <th>PLANILHA</th>
    <th>PDF</th>
    <th>DIFERENÇA</th>
  </tr>
  <tr>
    <td>Total registros</td>
    <td>${sheetData.length}</td>
    <td>${pdfData.length}</td>
    <td>${sheetData.length - pdfData.length}</td>
  </tr>
  <tr>
    <td>Total Valor R$</td>
    <td>${totalAmountSheet}</td>
    <td>${totalAmountPdf}</td>
    <td>${totalAmountSheet - totalAmountPdf}</td>
  </tr>
  <tr>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Registros Diferentes</td>
    <td>${diferenceSheet.join('<br />') || '-'}</td>
    <td>${diferencePdf.join('<br />') || '-'}</td>
    <td>-</td>
  </tr>
</table>`;


    outputElement.innerHTML = outputData;
  } catch (error) {
    console.log(error);
    alert(`Erro no processamento: ${error.message}`);
  }
}

