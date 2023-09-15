const express = require("express");
const app = express();

const format = require("pg-format");

const { Pool } = require("pg");

app.use(express.json());

app.listen(3000, console.log("Servidor encendido Jupiii !!"));

const pool = new Pool({
    host: "localhost",
    user: "postgres",
    password: "jeaf89",
    database: "joyas",
    allowExitOnIdle: true
});

//Middleware para reporte
const reportarConsulta = async (req, res, next) => {
    const query = req.query;
    const url = req.url;

    console.log(`
    Hoy ${new Date()}
    se ha recibido una consulta de inventario en la ruta ${url}
    con los parametros:
    `, query)
    next()
}

//Funcion GET de todo el inventario
const getJoyas = async () => {
    const { rows } = await pool.query("select * from inventario");
    return rows;
}

//Funcion GET de queryString en inventario
const getQueryStringJoyas = async({ limits, order_by, page}) => {
    const [campo,direccion] = order_by.split("_")
    const offset = (page - 1) * limits

    const formattedQuery = format('select * from inventario order by %s %s limit %s offset %s', campo, direccion, limits, offset);
    pool.query(formattedQuery);

    const { rows: joyas} = await pool.query(formattedQuery)
    if(joyas == 0){
        throw { code: 500, message: "No hay conicidencia con el filtro entregado" }
    }
    return joyas;
}

//Funcion GET filtro en inventario
const getFilterJoyas = async({ precio_max, precio_min, categoria, metal }) => {
    
    let filtros = [];
    let values   = [];

    const agregarFiltro = (campo,operador,valor) =>{
        values.push(valor);
        const { length } = filtros
        filtros.push(`${campo} ${operador} $${length + 1}`)
    } 
    
    /*if(precio_max) filtros.push(`precio <= ${precio_max}`)
    if(precio_min) filtros.push(`precio >= ${precio_min}`)
    if(categoria)  filtros.push(`categoria = '${categoria}'`)
    if(metal)      filtros.push(`metal = '${metal}'`)*/

    if(precio_max) agregarFiltro('precio', '<=', precio_max)
    if(precio_min) agregarFiltro('precio', '>=', precio_min)
    if(categoria)  agregarFiltro('categoria', '=', categoria)
    if(metal)      agregarFiltro('metal', '=', metal)

    let consulta = "select * from inventario"
    
    if(filtros.length > 0){
        filtros = filtros.join(" and ")
        consulta += ` where ${filtros}`
    }

    const { rows: joyas} = await pool.query(consulta, values)
    
    if (joyas == 0){        
        throw { code: 500, message: "No hay conicidencia con el filtro entregado" }
    }
    return joyas;
}

//Funcion HATEOAS
const preparaHATEOAS = (joyas) => {
    const results = joyas.map((j) => {
        return{
            name: j.nombre,
            href: `/joyas/joya/${j.id}`,
        }
    }).slice(0,6);
    const total = joyas.length;
    const HATEOAS = {
      total,
      results
    }
    return HATEOAS;
}
//GET todo el inventario
app.get("/joyas", reportarConsulta, async (req,res) =>{
    try{
        const queryStrings = req.query;
        const joyas = await getQueryStringJoyas(queryStrings);
        res.json(joyas);
    }catch(error){
        if(error.code = 42703){
            const message = {
                code: error.code,
                message: "No existe la columna señalada"
            }
            res.status(500).send(message)
        }
        res.status(500).send(error);
    }
});

//Funcion GET filter en invantario
app.get("/joyas/filtros", reportarConsulta, async (req,res) =>{
    try{
        //const joyas = await getJoyas();
        const queryStrings = req.query;
        const joyas = await getFilterJoyas(queryStrings);
        res.json(joyas);
    }catch(error){
        res.status(500).send(error);
    }
});

//HATEOAS
app.get("/joyashateoas", reportarConsulta, async (req,res) =>{
    try{
        const joyas = await getJoyas();
        const HATEOAS = await preparaHATEOAS(joyas);
        res.json(HATEOAS);
    }catch(error){
        res.status(500).send(error);
    }
});

