import { Transformation } from 'leaflet'
import React, { Component } from 'react'
import { Map, TileLayer, CircleMarker } from 'react-leaflet'
//import cpr from './cpr.csv'
import SOCAT from './SOCAT.csv'

function dd_mm_yyyy(str) {
  const m = str.match(/^(\d\d)\/(\d\d)\/(\d\d\d\d)$/)
  const d= m? new Date(m[3], m[2]-1, m[1]) : null
  if (!d || !d.getFullYear()) return null
  else return d
}

function dd_mm_yyyy_HH_MM(str) {
  const m = str.match(/^(\d\d)\/(\d\d)\/(\d\d\d\d) (\d\d):(\d\d)$/)
  const d= m? new Date(m[3], m[2]-1, m[1], m[4], m[5], 0) : null
  if (!d || !d.getFullYear()) return null
  else return d
}

class Emma extends Component {
  state = {}
  data={}
  componentDidMount() {
    //["Sample_Id", "Latitude", "Longitude", "Midpoint_Date_Local", "Year", "Month", "195", "10508", "10509", "10510", "10511", "10512", "10513", "10514", "10515"]
    //this.load_data({ data: cpr, name: 'cpr', cols: { x: 'Latitude', y: 'Longitude', date: 'Midpoint_Date_Local', n: '195'}, date:cprDate, errors:20})
    //["DATE", "LAT", "LON", " COUNT_NCRUISE", " FCO2_COUNT_NOBS", " FCO2_AVE_WEIGHTED", " FCO2_AVE_UNWTD", " FCO2_MIN_UNWTD", " FCO2_MAX_UNWTD", " SST_COUNT_NOBS", " SST_AVE_WEIGHTED", " SST_AVE_UNWTD", " SST_MIN_UNWTD", " SST_MAX_UNWTD", " SALINITY_COUNT_NOBS", " SALINITY_AVE_WEIGHTED", " SALINITY_AVE_UNWTD", " SALINITY_MIN_UNWTD", " SALINITY_MAX_UNWTD"
    this.load_data({ data: SOCAT, name: 'SOCAT', cols: { x: 'LAT', y: 'LON', date: 'DATE', n: 'FCO2_AVE_WEIGHTED'}, date:dd_mm_yyyy, errors:20})
    .then(d=>{
      this.data[d.name]=d
      if (d.errors.length) console.log(d.name,'errors',d.errors)
      console.log('SOCAT',d)
      this.setState({data:d,year:1993})
    }).catch(e=>{
      console.error(e.name,'too many errors',e.errors)
    })
  }
  load_data(f) {
    return new Promise((resolve, reject) => {
      fetch(f.data)
      .then(function (response) {
        return response.text()
      })
      .then(csv => {
        let rows = csv.split(/\r\n|\n/).map(l => { return l.replace(/"([^,]*), ([^,]*)"/, "$2 $1").replace(/"/g, '').split(',') })
        const head = rows[0].map(r=>{return r.trim()})
        const data = { name:f.name, l: {}, ps: {}, ys: {}, n: [], errors:[], lines:0}
        for (data.lines=1; data.lines<rows.length && data.errors.length<f.errors; data.lines++) {
          const r=rows[data.lines]
          const d = {},ks=Object.keys(f.cols)
          for (var i=0;i<ks.length;i++) {
            const k=ks[i]
            if (!r[head.indexOf(f.cols[k])]) {
              d.error=true
              if (!d.error) data.errors.push({e:'1',file:f.name,line:data.lines,k:k})
            }
            else {
              if (k === 'date') d[k]=f.date(r[head.indexOf(f.cols[k])])
              else d[k] = r[head.indexOf(f.cols[k])] * 1
            }
            if (!d[k] && d[k]!==0 && !d.error) {
              d.error=true
              data.errors.push({e:'2',file:f.name,line:data.lines,k:k})
            }
          }
          if (!d.error && ((!d.n&&d.n!==0) || (!d.x&&d.x!==0) || (!d.y&&d.y!==0) || !d.date)) {
            d.error=true
            data.errors.push({e:'3',file:f.name,line:data.lines,x:d.x,y:d.y,n:d.n})
          }
          if (!d.error) {
            const year=d.date&&d.date.getFullYear()
            if (!data[year]) data[year] = []
            data[year].push(d)
            const p = Math.round(d.x) * 1000 + Math.round(d.y)
            if (!data.ps[p]) data.ps[p] = {}
            if (!data.ps[p][year]) data.ps[p][year] = []
            data.ps[p][year].push(d)
              ;['x', 'y', 'n'].forEach(k => {
                if (data.l[k] === undefined) data.l[k] = { min: d[k], max: d[k] }
                else if (d[k] < data.l[k].min) data.l[k].min = d[k]
                else if (d[k] > data.l[k].max) data.l[k].max = d[k]
              })
          }
        }
        if (data.errors.length<f.errors) {
          Object.keys(data.ps).forEach(p => {
          const n = Object.keys(data.ps[p]).length
          Object.keys(data.ps[p]).forEach(y => {
            if (!data.ys[y]) data.ys[y] = []
            if (!data.ys[y][n]) data.ys[y][n] = []
            data.ys[y][n].push(p)
          })
          if (!data.n[n]) data.n[n] = []
            data.n[n].push(p)
          })
          data.t = this.totals(data)
          resolve(data)
        }
        else reject(data)
      })
    })
  }
  totals(data) {
    const ret = {}
    Object.keys(data.ys).forEach(y => {
      Object.keys(data.ys[y]).forEach(c => {
        let t = 0, n = 0
        data.ys[y][c].forEach(p => {
          data.ps[p][y].forEach(d => {
            n += 1 / data.ps[p][y].length
            t += d.n / data.ps[p][y].length
          })
        })
        if (!ret[y]) ret[y] = {}
        if (!ret[y][c]) ret[y][c] = {}
        ret[y][c] = { n: n, t: t }
      })
    })
    //console.log('totals',ret)
    return ret
  }
  render() {
    const year = this.state.y || this.state.year
    if (!year) return null
    const l=this.state.data.l
    if (!this.state.y) setTimeout(() => this.setState({ year: year === 2018 ? 1993 : year + 1 }), year === 2018 ? 5000 : 1000)
    return <div>
      <div>
        <Select ks={Object.keys(this.state.data.ys)} k={this.state.y} set={(y) => this.setState({ y: y })} name="Year" />
        <Select ks={Object.keys(this.state.data.n).reverse()} k={this.state.n} set={(n) => this.setState({ n: n })} name="N" />
        <span>{year}</span>
      </div>
      <Map bounds={[[l.x.min, l.y.min], [l.x.max, l.y.max]]}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <Points data={this.state.data} year={year} n={this.state.n||0} />
      </Map>
      <Totals data={this.state.data}/>
    </div>
  }
}
class Points extends Component {
  render() {
    let ret = [], i = 0
    this.props.data[this.props.year].forEach(d => {
      const p = Math.round(d.x) * 1000 + Math.round(d.y)
      if (Object.keys(this.props.data.ps[p]).length >= this.props.n) {
        const l = this.props.data.l, c = d.n / (l.n.max - l.n.min)
        const color = c === 0 ? '' : c > 0.2 ? c > 0.5 ? 'red' : 'blue' : 'green'
        ret.push(<CircleMarker key={i++} center={[d.x, d.y]} radius={1} color={color} />)
      }
    })
    return ret
  }
}

class Totals extends Component {
  render() {
    const d = this.props.data, totals = this.props.data['t']
    return <table>
      <thead><tr><th>Years</th>
        {Object.keys(d.n).reverse().map(n => {
          return <th colSpan={4} key={n}>{n}</th>
        })}
      </tr>
        <tr><th>Year</th>
          {Object.keys(d.n).reverse().map(n => {
            return <React.Fragment key={n}><th>n</th><th>total</th><th>μ</th><th>μ+</th></React.Fragment>
          })}
        </tr>
      </thead>
      <tbody>
        {Object.keys(totals).map(y => {
          let t = 0, n = 0
          return <tr key={y}><td>{y}</td>
            {Object.keys(d.n).reverse().map(c => {
              if (!totals[y][c]) return <React.Fragment key={c}><td></td><td></td><td></td><td></td></React.Fragment>
              const dt = totals[y][c].t, dn = totals[y][c].n
              t += dt
              n += dn
              return <React.Fragment key={c}><td>{Math.round(dn)}</td><td>{Math.round(dt)}</td><td>{Math.round(dt / dn)}</td><td>{Math.round(t / n)}</td></React.Fragment>
            })}</tr>
        })}
      </tbody>
    </table>
  }
}

class Select extends Component {
  set = (e) => {
    e.preventDefault()
    this.props.set(e.target.value)
  }
  render() {
    let options = [<option key={0} value=''>{this.props.name}</option>]
    this.props.ks.forEach(e => { options.push(<option key={e}>{e}</option>) })
    return <span>
      <select value={this.props.k || ''} onChange={this.set}>{options}</select>
    </span>
  }
}

export {Emma}