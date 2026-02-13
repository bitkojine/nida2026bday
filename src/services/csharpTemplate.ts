export const CSHARP_TEMPLATE = `public class DanceRules : IDanceRules
{
    // === GALI KEISTI ŽEMIAU ===

    // Laiko langas (sekundėmis), kada paspaudimas laikomas TOBULU
    public float tobulasLangas = 0.05f;

    // Laiko langas (sekundėmis), kada paspaudimas laikomas GERU
    public float gerasLangas = 0.12f;

    // Taškai už TOBULĄ paspaudimą
    public int tobuliTaskai = 100;

    // Taškai už GERĄ paspaudimą
    public int geriTaskai = 50;

    // Kiek paspaudimų iš eilės reikia, kad įsijungtų UŽSIVEDIMAS
    public int serijaIkiHype = 10;

    // Arklio kūno spalva (HEX, pvz. #d6b48a)
    public string arklioSpalva = "#d6b48a";

    // Arklio karčių ir kojų spalva (HEX)
    public string karciuSpalva = "#7d4f2d";

    // Uždėti kepurę ant arklio (true / false)
    public bool suKepure = false;

    // Oras aplink arklį (SAULETA / LIETINGA / SNIEGAS)
    public string oroEfektas = "SAULETA";

    // === GALI KEISTI AUKŠČIAU ===

    public bool ArTobulas(float paklaida)
    {
        return paklaida <= tobulasLangas;
    }

    public bool ArGeras(float paklaida)
    {
        return paklaida <= gerasLangas;
    }

    public int SkaiciuotiTaskus(bool tobulas, bool geras)
    {
        if (tobulas)
        {
            return tobuliTaskai;
        }

        if (geras)
        {
            return geriTaskai;
        }

        return 0;
    }

    public bool ArHypeRezimui(int serija)
    {
        return serija >= serijaIkiHype;
    }
}`;
