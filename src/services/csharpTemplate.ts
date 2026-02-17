export const CSHARP_TEMPLATE = `public enum KepuresTipas
{
    KLASIKINE,
    KAUBOJAUS,
    KARUNA,
    RAGANOS
}

public enum OroEfektas
{
    SAULETA,
    LIETINGA,
    SNIEGAS,
    ZAIBAS
}

public enum Spalva
{
    SMELIO,
    TAMSIAI_RUDA,
    RUDA,
    JUODA,
    BALTA,
    AUKSINE,
    ROZINE,
    MELYNA,
    ZALIA,
    VIOLETINE,
    ORANZINE
}

public class DanceRules
{
    public float tobulasLangas = 0.05f;
    public float gerasLangas = 0.12f;
    public int tobuliTaskai = 100;
    public int geriTaskai = 50;
    public int serijaIkiUzsivedimo = 10;
    public Spalva arklioSpalva = Spalva.SMELIO;
    public Spalva karciuSpalva = Spalva.TAMSIAI_RUDA;
    public bool suKepure = false;
    public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;
    public OroEfektas oroEfektas = OroEfektas.SAULETA;

    public Spalva AkiuSpalva()
    {
        return Spalva.JUODA;
    }
}`;
