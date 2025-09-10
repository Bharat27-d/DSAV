class Node {
    int data;
    Node next;

    Node(int data) {
        this.data = data;
        this.next = null;
    }
}

class LinkedListt {
    Node head;

    // Insert at end
    void insert(int data) {
        Node newNode = new Node(data);
        if (head == null) {
            head = newNode;
        } else {
            Node temp = head;
            while (temp.next != null) temp = temp.next;
            temp.next = newNode;
        }
        System.out.println(data + " inserted");
    }

    // Delete first element
    void delete() {
        if (head == null) {
            System.out.println("List is empty");
            return;
        }
        System.out.println(head.data + " deleted");
        head = head.next;
    }

    // Print list
    void display() {
        if (head == null) {
            System.out.println("List is empty");
            return;
        }
        Node temp = head;
        System.out.print("List: ");
        while (temp != null) {
            System.out.print(temp.data + (temp.next != null ? " -> " : ""));
            temp = temp.next;
        }
        System.out.println();
    }
}

public class Mainnn {
    public static void main(String[] args) {
        LinkedListt list = new LinkedListt();

        list.insert(10);
        list.insert(20);
        list.insert(30);
        list.display();

        list.delete();
        list.display();

        list.delete();
        list.delete();
        list.delete(); // extra delete to show empty list
    }
}
