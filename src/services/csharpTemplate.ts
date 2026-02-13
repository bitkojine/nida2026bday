export const CSHARP_TEMPLATE = `public class DanceRules : IDanceRules
{
    // === GALI KEISTI ZEMIAU ===

    // Laiko langas (sekundemis), kada paspaudimas laikomas TOBULU
    public float tobulasLangas = 0.05f;

    // Laiko langas (sekundemis), kada paspaudimas laikomas GERU
    public float gerasLangas = 0.12f;

    // Taskai uz TOBULA paspaudima
    public int tobuliTaskai = 100;

    // Taskai uz GERA paspaudima
    public int geriTaskai = 50;

    // Kiek paspaudimu is eiles reikia, kad isijungtu UZSIVEDIMAS
    public int serijaIkiHype = 10;

    // Arklio kuno spalva (HEX, pvz. #d6b48a)
    public string arklioSpalva = "#d6b48a";

    // Arklio karciu ir koju spalva (HEX)
    public string karciuSpalva = "#7d4f2d";

    // Uzdeti kepure ant arklio (true / false)
    public bool suKepure = false;

    // === GALI KEISTI AUKSCIAU ===

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
