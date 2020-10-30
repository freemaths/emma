import React, { Component } from 'react'
import {Map, TileLayer, CircleMarker} from 'react-leaflet'
import cpr from './cpr.csv'
class Emma extends Component {
  state={}
  componentDidMount() {
    fetch(cpr)
  .then(function(response) {
    return response.text()
  })
  .then(csv=>{
      let rows=csv.split(/\r\n|\n/).map(l=>{return l.replace(/"([^,]*), ([^,]*)"/,"$2 $1").replace(/"/g,'').split(',')})
      const head=rows[0]
      //["Sample_Id", "Latitude", "Longitude", "Midpoint_Date_Local", "Year", "Month", "195", "10508", "10509", "10510", "10511", "10512", "10513", "10514", "10515"]
      rows.shift()
      let data={l:{},ps:{},ys:{},n:[]}
      rows.forEach(r=>{
        const year=r[head.indexOf('Year')]*1,x=r[head.indexOf('Latitude')]*1,y=r[head.indexOf("Longitude")]*1,n=r[head.indexOf("195")]*1,date=new Date(r[head.indexOf("Midpoint_Date_Local")])
        if (year>1992 && year<2019)
        {
          const d={x:x,y:y,date:date,n:n}
          if (!data[year]) data[year]=[]
          data[year].push(d)
          const p=Math.round(d.x)*1000+Math.round(d.y)
          if (!data.ps[p]) data.ps[p]={}
          if (!data.ps[p][year]) data.ps[p][year]=[]
          data.ps[p][year].push(d)
          ;['x','y','n'].forEach(k=>{
            if (data.l[k]===undefined) data.l[k]={min:d[k],max:d[k]}
            else if (d[k]<data.l[k].min) data.l[k].min=d[k]
            else if (d[k]>data.l[k].max) data.l[k].max=d[k]
          })
        }
      })
      Object.keys(data.ps).forEach(p=>{
        const n=Object.keys(data.ps[p]).length
        Object.keys(data.ps[p]).forEach(y=>{
          if (!data.ys[y]) data.ys[y]=[]
          if (!data.ys[y][n]) data.ys[y][n]=[]
          data.ys[y][n].push(p)
        })
        if (!data.n[n]) data.n[n]=[]
        data.n[n].push(p)
      })
      this.setState({data:data,year:1993,n:0,totals:this.totals(data)})
      //console.log('data',data.ps[29960],data.ys[1993])
    })
  }
  totals(data) {
    const ret={}
    Object.keys(data.ys).forEach(y=>{
      Object.keys(data.ys[y]).forEach(c=>{
        let t=0,n=0
        data.ys[y][c].forEach(p=>{
          data.ps[p][y].forEach(d=>{
            n+=1/data.ps[p][y].length
            t+=d.n/data.ps[p][y].length
          })
        })
        if (!ret[y]) ret[y]={}
        if (!ret[y][c]) ret[y][c]={}
        ret[y][c]={n:n,t:t}
      })
    })
    //console.log('totals',ret)
    return ret
  }
  render() {
    const year=this.state.y||this.state.year,l=this.state.data&&this.state.data.l
    if (!year) return null
    if (!this.state.y) setTimeout(()=>this.setState({year:year===2018?1993:year+1}),year===2018?5000:1000)
    return <div>
      <div>
        <Select ks={Object.keys(this.state.data.ys)} k={this.state.y} set={(y)=>this.setState({y:y})} name="Year" />
        <Select ks={Object.keys(this.state.data.n).reverse()} k={this.state.n} set={(n)=>this.setState({n:n})} name="N" />
        <span>{year}</span>
      </div>
      <Map bounds={[[l.x.min,l.y.min],[l.x.max,l.y.max]]}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      <Points data={this.state.data} year={year} n={this.state.n} />
      </Map>
      <Totals data={this.state.data} totals={this.state.totals}/>
      </div>
  }
}
class Points extends Component {
  render() {
    let ret=[],i=0
    this.props.data[this.props.year].forEach(d=>{
      const p=Math.round(d.x)*1000+Math.round(d.y)
      if (Object.keys(this.props.data.ps[p]).length>=this.props.n) {
        const l=this.props.data.l,c=d.n/(l.n.max-l.n.min)
        const color=c===0?'':c>0.2?c>0.5?'red':'blue':'green'
        ret.push(<CircleMarker key={i++} center={[d.x,d.y]} radius={1} color={color}/>)
      }
    })
    return ret
  }
}

class Totals extends Component {
  render() {
    const d=this.props.data,totals=this.props.totals
    return <table>
    <thead><tr><th>Years</th>
    {Object.keys(d.n).reverse().map(n=>{
      return <th colspan={4} key={n}>{n}</th>
    })}
    </tr>
   <tr><th>Year</th>
    {Object.keys(d.n).reverse().map(n=>{
      return <React.Fragment key={n}><th>n</th><th>total</th><th>μ</th><th>μ+</th></React.Fragment>
    })}
    </tr>
    </thead>  
    <tbody>
    {Object.keys(totals).map(y=>{
      let t=0,n=0
      return <tr key={y}><td>{y}</td>
      {Object.keys(d.n).reverse().map(c=>{
        if (!totals[y][c]) return <React.Fragment key={c}><td></td><td></td><td></td><td></td></React.Fragment>
        const dt=totals[y][c].t,dn=totals[y][c].n
        t+=dt
        n+=dn
        return <React.Fragment key={c}><td>{Math.round(dn)}</td><td>{Math.round(dt)}</td><td>{Math.round(dt/dn)}</td><td>{Math.round(t/n)}</td></React.Fragment>
      })}</tr>})}
      </tbody>
    </table>
  }
}

class Select extends Component {
  set=(e)=>{
    e.preventDefault()
    this.props.set(e.target.value)
  }
  render() {
  let options=[<option key={0} value=''>{this.props.name}</option>]
    this.props.ks.forEach(e=>{options.push(<option key={e}>{e}</option>)})
    return <span>
      <select value={this.props.k||''} onChange={this.set}>{options}</select>
    </span>
  }
}

export default Emma
