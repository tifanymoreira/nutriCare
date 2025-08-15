export async function validarCRN(crn) {
  const regex = /^\d{6,7}(-\d)?$/;
  if (!regex.test(crn)) {
    return false;
  }

  const partes = crn.split('-');
  const numero = partes[0];
  const digitoVerificador = partes.length > 1 ? partes[1] : null;

  if (numero.length === 7 && digitoVerificador) {
    const calculoDigito = calcularDigitoVerificador(numero);
    return calculoDigito === parseInt(digitoVerificador);
  } else if (numero.length === 6 || numero.length === 7){
    return true; 
  }

  return false;
}

function calcularDigitoVerificador(numero) {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * peso;
    peso++;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}
