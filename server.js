const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');
const app = express();

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_ANFRAGEN_ID = 1525698169;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// 🔧 Hilfsfunktion: Datum formatieren
function formatDatum(input) {
  if (!input) return '';
  const [yyyy, mm, dd] = input.split("-");
  return `${dd}.${mm}.${yyyy}`;
}

app.post('/submit', upload.array('files'), async (req, res) => {
  const {
    name,
    email,
    telefon,
    hochschule,
    thema,
    frage,
    stil,
    fachbereich,
    studiengang,
    fach,
    abgabe,
    sonstiges
  } = req.body;

  const kommentar = `
E-Mail: ${email}
Telefonnummer: ${telefon}
Hochschule: ${hochschule}
Thema der Arbeit: ${thema}
Forschungsfrage: ${frage}
Zitierstil: ${stil}
Fachbereich: ${fachbereich}
Studiengang: ${studiengang}
Fach: ${fach}
Abgabedatum: ${formatDatum(abgabe)}
Sonstiges: ${sonstiges}
  `;

  const mutationCreateItem = `
    mutation {
      create_item (
        board_id: ${BOARD_ANFRAGEN_ID},
        item_name: "${(name || "Unbekannt").toString().trim()}"
      ) {
        id
      }
    }
  `;

  try {
    // 1. Item erstellen
    const itemResp = await axios.post(
      'https://api.monday.com/v2',
      { query: mutationCreateItem },
      { headers: { Authorization: MONDAY_API_TOKEN } }
    );
    const itemId = itemResp.data.data.create_item.id;

    // 2. Kommentar hinzufügen
    const mutationAddUpdate = `
      mutation {
        create_update(item_id: ${itemId}, body: """${kommentar}""") {
          id
        }
      }
    `;
    const updateResp = await axios.post(
      'https://api.monday.com/v2',
      { query: mutationAddUpdate },
      { headers: { Authorization: MONDAY_API_TOKEN } }
    );
    const updateId = updateResp.data.data.create_update.id;

    // 3. Dateien anhängen (falls vorhanden)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const form = new FormData();
        form.append('query', `
          mutation ($file: File!) {
            add_file_to_update(update_id: ${updateId}, file: $file) {
              id
            }
          }
        `);
        form.append('variables[file]', fs.createReadStream(file.path), {
          filename: file.originalname
        });

        await axios.post('https://api.monday.com/v2/file', form, {
          headers: {
            Authorization: MONDAY_API_TOKEN,
            ...form.getHeaders()
          }
        });

        fs.unlinkSync(file.path); // Datei löschen
      }
    }

    res.send('✅ Anfrage erfolgreich übermittelt.');
  } catch (error) {
    console.error("❌ Fehler:", JSON.stringify(error.response?.data || error.message, null, 2));
    res.status(500).send('❌ Fehler bei der Übertragung.');
  }
});

app.listen(3000, () => {
  console.log('🟢 Server läuft auf http://localhost:3000');
});
