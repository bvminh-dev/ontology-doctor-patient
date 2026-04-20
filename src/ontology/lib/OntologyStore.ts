
import { Store, Parser, DataFactory as DF, Quad, NamedNode, Literal } from 'n3';

/**
 * OntologyStore - Wrapper around N3 Store for managing RDF triples
 * Provides methods for loading schema, adding triples, and querying
 */
export class OntologyStore {
  private store: Store;
  private parser: Parser;
  private dataFactory: typeof DF;

  constructor() {
    this.store = new Store();
    this.parser = new Parser();
    this.dataFactory = DF;
  }

  /**
   * Load ontology schema from Turtle format
   * @param schemaTTL - Turtle format string containing ontology schema
   */
  async loadSchema(schemaTTL: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.parser.parse(schemaTTL, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.store.addQuad(quad);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Add a triple to the store
   * @param subject - Subject URI or blank node identifier
   * @param predicate - Predicate URI
   * @param object - Object URI or literal value
   * @param datatype - Optional datatype for literal values
   */
  addTriple(subject: string, predicate: string, object: string, datatype?: string): void {
    const s = this.dataFactory.namedNode(subject);
    const p = this.dataFactory.namedNode(predicate);

    let o: NamedNode | Literal;
    if (datatype) {
      o = this.dataFactory.literal(object, this.dataFactory.namedNode(datatype));
    } else if (this.isURI(object)) {
      o = this.dataFactory.namedNode(object);
    } else {
      o = this.dataFactory.literal(object);
    }

    this.store.addQuad(s, p, o);
  }

  /**
   * Add a quad (triple with graph) to the store
   */
  addQuad(subject: string, predicate: string, object: string, graph?: string): void {
    const s = this.dataFactory.namedNode(subject);
    const p = this.dataFactory.namedNode(predicate);

    let o: NamedNode | Literal;
    if (this.isURI(object)) {
      o = this.dataFactory.namedNode(object);
    } else {
      o = this.dataFactory.literal(object);
    }

    const g = graph ? this.dataFactory.namedNode(graph) : this.dataFactory.defaultGraph();

    this.store.addQuad(s, p, o, g);
  }

  /**
   * Query triples from the store
   * @param subject - Optional subject filter
   * @param predicate - Optional predicate filter
   * @param object - Optional object filter
   * @returns Array of matching quads
   */
  query(subject?: string, predicate?: string, object?: string): Quad[] {
    const s = subject ? this.dataFactory.namedNode(subject) : null;
    const p = predicate ? this.dataFactory.namedNode(predicate) : null;

    let o: ReturnType<typeof this.dataFactory.namedNode | typeof this.dataFactory.literal> | null = null;
    if (object) {
      if (this.isURI(object)) {
        o = this.dataFactory.namedNode(object);
      } else {
        o = this.dataFactory.literal(object);
      }
    }

    return Array.from(this.store.getQuads(s, p, o, null));
  }

  /**
   * Get all triples matching a pattern
   */
  getQuads(subject: string | null, predicate: string | null, object: string | null): Quad[] {
    const s = subject ? this.dataFactory.namedNode(subject) : null;
    const p = predicate ? this.dataFactory.namedNode(predicate) : null;

    let o: ReturnType<typeof this.dataFactory.namedNode | typeof this.dataFactory.literal> | null = null;
    if (object) {
      if (this.isURI(object)) {
        o = this.dataFactory.namedNode(object);
      } else {
        o = this.dataFactory.literal(object);
      }
    }

    return Array.from(this.store.getQuads(s, p, o, null));
  }

  /**
   * Get a single object value for a subject-predicate pair
   */
  getObject(subject: string, predicate: string): string | undefined {
    const quads = this.query(subject, predicate);
    return quads.length > 0 ? quads[0].object.value : undefined;
  }

  /**
   * Get all objects for a subject-predicate pair
   */
  getObjects(subject: string, predicate: string): string[] {
    const quads = this.query(subject, predicate);
    return quads.map(q => q.object.value);
  }

  /**
   * Check if a triple exists
   */
  hasTriple(subject: string, predicate: string, object: string): boolean {
    const quads = this.query(subject, predicate, object);
    return quads.length > 0;
  }

  /**
   * Remove a triple from the store
   */
  removeTriple(subject: string, predicate: string, object: string): void {
    const s = this.dataFactory.namedNode(subject);
    const p = this.dataFactory.namedNode(predicate);

    let o: ReturnType<typeof this.dataFactory.namedNode | typeof this.dataFactory.literal>;
    if (this.isURI(object)) {
      o = this.dataFactory.namedNode(object);
    } else {
      o = this.dataFactory.literal(object);
    }

    const quads = this.store.getQuads(s, p, o, null);
    quads.forEach(quad => this.store.removeQuad(quad));
  }

  /**
   * Clear all triples from the store
   */
  clear(): void {
    this.store = new Store();
  }

  /**
   * Get the underlying N3 Store
   */
  getStore(): Store {
    return this.store;
  }

  /**
   * Get the size of the store (number of quads)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Export store to Turtle format
   */
  async toTurtle(): Promise<string> {
    const { Writer } = await import('n3');
    return new Promise((resolve, reject) => {
      const writer = new Writer({ format: 'text/turtle' });
      const quads: string[] = [];

      writer.addQuads(this.store.getQuads(null, null, null, null));
      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Create a term (NamedNode or Literal) from a string
   */
  private createTerm(value: string): NamedNode | Literal {
    if (this.isURI(value)) {
      return this.dataFactory.namedNode(value);
    }
    return this.dataFactory.literal(value);
  }

  /**
   * Check if a string is a URI
   */
  private isURI(str: string): boolean {
    return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('urn:');
  }

  /**
   * Get all subjects of a specific type
   */
  getSubjectsByType(type: string): string[] {
    const quads = this.query(undefined, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', type);
    return [...new Set(quads.map(q => q.subject.value))];
  }

  /**
   * Get all triples where subject is of a given type
   */
  getTriplesByType(type: string): Quad[] {
    const subjects = this.getSubjectsByType(type);
    const allQuads: Quad[] = [];

    for (const subject of subjects) {
      const quads = this.query(subject);
      allQuads.push(...quads);
    }

    return allQuads;
  }

  /**
   * Create a blank node
   */
  createBlankNode(): string {
    return this.dataFactory.blankNode().value;
  }
}

export default OntologyStore;
