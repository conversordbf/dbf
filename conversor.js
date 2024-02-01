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

document.querySelector("html").classList.add('js');

const fileInputSheet = document.getElementById("input-file");
const buttonSheet = document.getElementById("input-file-button");
const fileReturn = document.getElementById("file-return");

buttonSheet.addEventListener("click", (event) => {
  event.preventDefault();
  fileInputSheet.focus();
});

fileInputSheet.addEventListener("change", (event) => {
  fileReturn.innerHTML = `Arquivo Selecionado: ${event.target.files[0].name}`;
});

function handleDownloadTxt(fileContent) {
  try {
    const fileData = new Blob([fileContent], { type: "text/plain;charset=ISO-8859-1" });
    saveAs(fileData, `dbf.txt`);

    // const url = window.URL.createObjectURL(fileData);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `dbf.txt`;
    // a.click();
  } catch (error) {
    console.log(error);
  }
}

function readSheetFileContent(data) {
  // const workbook = XLSX.readFile(file);
  // for readAsDataURL
  // const workbook = XLSX.read(data.replace(/_/g, "/").replace(/-/g, "+"), { type:'base64' });
  const workbook = XLSX.read(data, { type: 'buffer' });
  const sheetNameList = workbook.SheetNames;
  const worksheet = workbook.Sheets[sheetNameList[0]];
  const sheetData = XLSX.utils.sheet_to_json(worksheet, {
    header: [
      'CNPJBasico', 'AnoCalendario', 'TipoDeFundo', 'CNPJBenefic', 'CNPJDoador', 'TipoDoacao', 'ValorDoacao']
  });
  return sheetData;
}

function formatDataToLayoutDBF(jsonData) {
  function sanitizeOnlyNumbers(value) {
    return String(value).replace(/\D/gi, '').slice(0, 14);
  }

  function formatCnpjCpf(value) {
    const sanitizedInput = sanitizeOnlyNumbers(value);
    return sanitizedInput.length <= 11 ? sanitizedInput.padStart(11, '0').padEnd(14, ' ') : sanitizedInput.padStart(14, '0');
    // try {
    // if(sanitizedInput.length !== 14 || sanitizedInput.length !== 11) {
    //   throw "O arquivo possui CPF/CNPJ Inválido, por favor verifique e tente novamente";
    // }
    // } catch (error) {
    //   alert(error);
    // }
  }

  function formatCurrency(value) {
    return String(value.toFixed(2)).replace('.', '').padStart(14, '0');
  }

  const outputData = [];
  let totalRecordsType1 = 0;
  let totalRecordsType2 = 0;

  jsonData.filter((row, idx) => idx !== 0).forEach((row, idx) => {
    // header record type 0
    if (idx === 0) {
      outputData.push(`0${sanitizeOnlyNumbers(row.CNPJBasico).padStart(8, '0')}${row.AnoCalendario}02`);
    }

    if (Number(row.TipoDeFundo) === 1) {
      totalRecordsType1 = totalRecordsType1 + 1;
    }

    if (Number(row.TipoDeFundo) === 2) {
      totalRecordsType2 = totalRecordsType2 + 1;
    }

    const line = `${row.TipoDeFundo}${formatCnpjCpf(row.CNPJBenefic)}${formatCnpjCpf(row.CNPJDoador)}${String(row.TipoDoacao).padStart(2, '0')}${formatCurrency(row.ValorDoacao)}`;
    outputData.push(line);

    // // footer record type 9
    if (idx === (jsonData.length - 2)) {
      outputData.push(`9${String(totalRecordsType1).padStart(6, '0')}${String(totalRecordsType2).padStart(6, '0')}`);
      // required blank line
      outputData.push('');
    }
  });

  return outputData.join('\r\n');
  // return outputData.join('\n');
}

async function run() {
  if (!fileInputSheet.files[0] || fileInputSheet.files[0].type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    alert('Slecione o arquivo da planilha');
    return;
  }

  const sheetFileContent = await getFileContent(fileInputSheet.files[0], readSheetFileContent);
  const outputData = formatDataToLayoutDBF(sheetFileContent);
  handleDownloadTxt(outputData);
}
